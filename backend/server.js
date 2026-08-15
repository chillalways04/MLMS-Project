require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path'); 
const bcrypt = require('bcryptjs'); 

const SECRET_KEY = process.env.JWT_SECRET;
console.log("Secret Key Loaded:", SECRET_KEY ? "Yes" : "No");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const dbPath = path.resolve(__dirname, 'Alldata.db');

const db = new sqlite3.Database(dbPath,(err) =>{
    if (err){
        console.log(err.message);
    }
    console.log('Connect to Database.');

    db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
            if (pragmaErr) console.error('เปิด Foreign Key ล้มเหลว:', pragmaErr);
            else console.log('เปิดใช้งาน Foreign Key Support เรียบร้อย');
            });
});

app.get('/api/lines', (req, res) => {
    const sql = 'SELECT * FROM lines';
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.get('/api/sections', (req, res) => {
    const lineId = req.query.line_id;
    let sql = 'SELECT * FROM sections';
    let params = [];

    if (lineId) {
        sql += ' WHERE line_id = ?';
        params.push(lineId);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/teams', (req, res) => {
    const sectionId = req.query.section_id;
    let sql = 'SELECT * FROM teams';
    let params = [];

    if (sectionId) {
        sql += ' WHERE section_id = ?';
        params.push(sectionId);
    }

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/login', (req, res) => {
    const { employee_code, password } = req.body;
    
    if (!employee_code || !password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสพนักงานเเละรหัสผ่าน' });
    }

    const sql = `
        SELECT users.*, 
               certificates.verification_code, 
               certificates.uuid AS cert_uuid
        FROM users 
        LEFT JOIN certificates ON users.id = certificates.user_id 
        WHERE users.employee_code = ?
    `;

    db.get(sql, [employee_code], async (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'ไม่พบรหัสพนักงานนี้ในระบบ' });
        }

        try {
            const dbPassword = user.password ? String(user.password).trim() : "";
            const inputPassword = password ? String(password).trim() : "";
            
            let isMatch = false;

            if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
                isMatch = await bcrypt.compare(inputPassword, dbPassword);
            } else {
                isMatch = (inputPassword === dbPassword);
            }

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
            }
            const safeUserData = {
                id: user.id,
                employee_code: user.employee_code,
                first_name: user.first_name,
                last_name: user.last_name,
                position: user.position,
                role_id: user.role_id,
                team_id: user.team_id,
                verification_code: user.verification_code, 
                cert_uuid: user.cert_uuid
            };

            res.json({
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                user: safeUserData 
            });

        } catch (compareErr) {
            console.error("Bcrypt Compare Error:", compareErr);
            return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน' });
        }
    });
});

app.get('/api/verify-cert/:uuid', (req, res) => {
    const { uuid } = req.params;

    console.log(`Finding มีคำขอตรวจสอบใบรับรอง UUID: [${uuid}]`);

    const sql = `
        SELECT 
            certificates.verification_code,
            certificates.issued_at,
            users.first_name,
            users.last_name,
            users.employee_code,
            users.position
        FROM certificates
        INNER JOIN users ON certificates.user_id = users.id
        WHERE certificates.uuid = ?
    `;

    db.get(sql, [uuid], (err, certData) => {
        if (err) {
            console.error("Failed เกิดข้อผิดพลาดในระบบฐานข้อมูล:", err.message);
            return res.status(500).json({ success: false, message: err.message });
        }
        
        if (!certData) {
            console.log(`Failed ตรวจสอบล้มเหลว: ไม่พบ UUID [${uuid}] ในระบบ`);
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลใบประกาศนียบัตรนี้ในระบบ' });
        }

        console.log(`Success ตรวจสอบสำเร็จ: เป็นใบเซอร์ของ คุณ${certData.first_name} ${certData.last_name}`);
        
        res.json({
            success: true,
            data: certData
        });
    });
});


app.post('/api/register', async (req, res) => {
    const { password, first_name, last_name, employee_code, position, team_id } = req.body;

    if (!password || !first_name || !last_name || !employee_code || !team_id) {
        return res.status(400).json({ 
            success: false, 
            message: "กรุณากรอกข้อมูลที่จำเป็นรวมถึงเลือกทีมให้ครบถ้วน" 
        });
    }

    const getRoleId = (pos) => {
        if (!pos) return 1;
        const p = pos.toLowerCase();
        if (p.includes('supervisor')) return 3;
        if (p.includes('leader')) return 2;
        return 1;
    };

    const roleId = getRoleId(position);

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

        const sql = `
            INSERT INTO users (
                employee_code, 
                first_name, 
                last_name, 
                position, 
                role_id, 
                team_id, 
                created_at, 
                password
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            employee_code,
            first_name,
            last_name,
            position || 'Operator A',
            roleId,
            team_id,
            createdAt,
            hashedPassword
        ];

        db.run(sql, params, function(err) {
            if (err) {
                console.error("Register Error:", err.message);
                if (err.message.includes("UNIQUE constraint failed")) {
                    return res.status(400).json({ 
                        success: false, 
                        message: "รหัสพนักงานนี้มีอยู่ในระบบแล้ว" 
                    });
                }
                return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
            }

            console.log(`บันทึกพนักงานสำเร็จ! User ID: ${this.lastID} (team_id: ${team_id}, role_id: ${roleId})`);
            return res.status(201).json({ success: true, message: "ลงทะเบียนพนักงานสำเร็จแล้ว" });
        });

    } catch (err) {
        console.error("Server Error:", err);
        return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" });
    }
});


app.listen(port,()=>{
    console.log(`Backend Server กำลังรันที่ http://localhost:${port}`)
});