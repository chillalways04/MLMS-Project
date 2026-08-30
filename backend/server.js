require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path'); 
const bcrypt = require('bcryptjs'); 
const helmet = require('helmet');                   
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid'); 

const SECRET_KEY = process.env.JWT_SECRET;
console.log("Secret Key Loaded:", SECRET_KEY ? "Yes" : "No");

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

const verifyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { 
    success: false, 
    message: 'มีการตรวจสอบใบรับรองถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' 
  }
});

const dbPath = path.resolve(__dirname, 'Alldata.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.log(err.message);
  }
  console.log('Connect to Database.');

  db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
    if (pragmaErr) console.error('เปิด Foreign Key ล้มเหลว:', pragmaErr);
    else console.log('เปิดใช้งาน Foreign Key Support เรียบร้อย');
  });
});


app.get('/api/lines', (req, res) => {
  const { user_id } = req.query;

  if (user_id) {
    const sql = `
      SELECT DISTINCT l.id, l.name
      FROM lines l
      JOIN sections s ON s.line_id = l.id
      JOIN teams t ON t.section_id = s.id
      JOIN users u ON u.team_id = t.id
      WHERE u.id = ?
    `;
    db.all(sql, [user_id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    db.all('SELECT * FROM lines', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
});

app.get('/api/sections', (req, res) => {
  const lineId = req.query.line_id;
  let sql = 'SELECT * FROM sections';
  const params = [];

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
  const params = [];

  if (sectionId) {
    sql += ' WHERE section_id = ?';
    params.push(sectionId);
  }

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


app.get('/api/courses', (req, res) => {
  const sql = 'SELECT id, title, description FROM courses ORDER BY id ASC';

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Fetch courses error:", err.message);
      return res.status(500).json({ 
        success: false, 
        message: "เกิดข้อผิดพลาดในการดึงข้อมูลหลักสูตร" 
      });
    }

    res.json({
      success: true,
      data: rows
    });
  });
});


app.post('/api/login', (req, res) => {
  const { employee_code, password } = req.body;
  
  if (!employee_code || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสพนักงานและรหัสผ่าน' });
  }

  const sql = `
    SELECT 
      users.*, 
      certificates.verification_code, 
      certificates.uuid AS cert_uuid,
      certificates.issued_at,
      cr.title AS course_title
    FROM users 
    LEFT JOIN certificates ON users.id = certificates.user_id 
    LEFT JOIN courses cr ON certificates.course_id = cr.id
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
        cert_uuid: user.cert_uuid,
        course_title: user.course_title,
        issued_at: user.issued_at
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


app.get('/api/user-dashboard/:userId', (req, res) => {
  const { userId } = req.params;

  const sql = `
    SELECT 
      es.id AS exam_score_id,
      es.score,
      es.status,
      es.tested_at,
      cr.id AS course_id,
      cr.title AS course_title,
      c.uuid AS cert_uuid,
      c.verification_code,
      c.issued_at
    FROM exam_scores es
    JOIN courses cr ON es.course_id = cr.id
    LEFT JOIN certificates c ON (c.user_id = es.user_id AND c.course_id = es.course_id)
    WHERE es.user_id = ?
    ORDER BY es.id DESC
  `;

  db.all(sql, [userId], async (err, rows) => {
    if (err) {
      console.error("Dashboard Fetch Error:", err.message);
      return res.status(500).json({ success: false, message: err.message });
    }

    const processedList = [];

    for (const row of rows) {
      const isPassed = String(row.status).trim().toLowerCase() === 'completed' || 
                       String(row.status).trim().toUpperCase() === 'PASS';
      
      let certUuid = row.cert_uuid;
      let verificationCode = row.verification_code;
      let issuedAt = row.issued_at;

      if (isPassed && !certUuid) {
        certUuid = uuidv4();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        verificationCode = `CERT-2026-${randomNum}`;
        issuedAt = new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const pdfUrl = `/certificates/${certUuid}.pdf`;

        const insertCertSql = `
          INSERT INTO certificates (uuid, verification_code, user_id, course_id, pdf_url, issued_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await new Promise((resolve) => {
          db.run(insertCertSql, [certUuid, verificationCode, userId, row.course_id, pdfUrl, issuedAt], (insertErr) => {
            if (insertErr) {
              console.error("Auto Insert Cert Error:", insertErr.message);
            } else {
              console.log(`[AUTO-CERT] สร้างใบเซอร์สำเร็จ: คอร์ส ${row.course_title} ให้ User ID: ${userId}`);
            }
            resolve();
          });
        });
      }

      processedList.push({
        exam_id: row.exam_score_id,
        course_id: row.course_id,
        course_title: row.course_title,
        score: row.score,
        status: row.status,
        is_passed: isPassed,
        tested_at: row.tested_at,
        cert_uuid: certUuid,
        verification_code: verificationCode,
        issued_at: issuedAt
      });
    }

    res.json({
      success: true,
      data: processedList
    });
  });
});

app.get('/api/verify-cert/:uuid', verifyLimiter, (req, res) => {
  const { uuid } = req.params;
  console.log(`[VERIFY] กำลังตรวจสอบใบรับรอง UUID: [${uuid}]`);

  const sql = `
    SELECT 
      c.uuid,
      c.verification_code,
      c.issued_at,
      u.first_name,
      u.last_name,
      u.employee_code,
      u.position,
      cr.title AS course_title
    FROM certificates c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN courses cr ON c.course_id = cr.id
    WHERE c.uuid = ?
  `;

  db.get(sql, [uuid], (err, certData) => {
    if (err) {
      console.error("[ERROR] เกิดข้อผิดพลาดในฐานข้อมูล:", err.message);
      return res.status(500).json({ 
        success: false, 
        message: "เกิดข้อผิดพลาดภายในระบบฐานข้อมูล" 
      });
    }

    if (!certData) {
      console.log(`[FAILED] ไม่พบ UUID [${uuid}] ในระบบ`);
      return res.status(404).json({ 
        success: false, 
        message: "ไม่พบข้อมูลใบประกาศนียบัตรนี้ในระบบ" 
      });
    }

    console.log(`[SUCCESS] ยืนยันสำเร็จ: คุณ${certData.first_name} ${certData.last_name} (${certData.course_title})`);

    res.json({
      success: true,
      data: certData
    });
  });
});


app.get('/api/supervisor/dashboard-summary', (req, res) => {
  const { supervisor_id, section_id, team_id } = req.query;

  // 1. ตรวจสอบสิทธิ์และหา line_id ของ Supervisor ที่เรียก API
  const supSql = `
    SELECT s.line_id 
    FROM users u
    JOIN teams t ON t.id = u.team_id
    JOIN sections s ON s.id = t.section_id
    WHERE u.id = ? AND u.role_id = 3
  `;

  db.get(supSql, [supervisor_id], (err, sup) => {
    if (err || !sup) {
      return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง หรือไม่ใช่หัวหน้างาน' });
    }

    const boundLineId = sup.line_id;

    // บังคับกรองเฉพาะพนักงาน (role_id = 1) ในสายการผลิตของตนเอง
    let filterCondition = 'WHERE u.role_id = 1 AND s.line_id = ?';
    const params = [boundLineId];

    if (team_id) {
      filterCondition += ` AND u.team_id = ?`;
      params.push(team_id);
    } else if (section_id) {
      filterCondition += ` AND s.id = ?`;
      params.push(section_id);
    }

    // 1. ดึงข้อมูลพนักงานและการสอบทั้งหมด
    const sqlMembers = `
      SELECT 
        u.id AS user_id,
        u.employee_code,
        u.first_name,
        u.last_name,
        u.position,
        l.name AS line_name,
        s.name AS section_name,
        t.id AS team_id,
        t.name AS team_name,
        cr.id AS course_id,
        cr.title AS course_title,
        es.score,
        es.status,
        es.tested_at,
        c.uuid AS cert_uuid,
        c.verification_code
      FROM users u
      JOIN teams t ON u.team_id = t.id
      JOIN sections s ON t.section_id = s.id
      JOIN lines l ON s.line_id = l.id
      LEFT JOIN exam_scores es ON u.id = es.user_id
      LEFT JOIN courses cr ON es.course_id = cr.id
      LEFT JOIN certificates c ON (u.id = c.user_id AND cr.id = c.course_id)
      ${filterCondition}
      ORDER BY u.id ASC, es.tested_at DESC
    `;

    // 2. ดึง 5 อันดับวิชาที่ตกบ่อยที่สุด
    const sqlTopFailed = `
      SELECT 
        cr.title AS course_title,
        COUNT(es.id) AS fail_count
      FROM exam_scores es
      JOIN users u ON es.user_id = u.id
      JOIN teams t ON u.team_id = t.id
      JOIN sections s ON t.section_id = s.id
      JOIN lines l ON s.line_id = l.id
      JOIN courses cr ON es.course_id = cr.id
      ${filterCondition} AND (LOWER(es.status) = 'failed' OR UPPER(es.status) = 'FAIL')
      GROUP BY cr.id
      ORDER BY fail_count DESC
      LIMIT 5
    `;

    // 3. เปรียบเทียบสถิติแต่ละทีมเฉพาะในสายการผลิตเดียวกัน
    const sqlTeamCompare = `
      SELECT 
        t.name AS team_name,
        COUNT(DISTINCT u.id) AS total_members,
        COUNT(CASE WHEN LOWER(es.status) = 'completed' OR UPPER(es.status) = 'PASS' THEN 1 END) AS passed_records,
        COUNT(es.id) AS total_exams,
        AVG(es.score) AS avg_score
      FROM teams t
      JOIN sections s ON s.id = t.section_id
      JOIN users u ON u.team_id = t.id
      LEFT JOIN exam_scores es ON u.id = es.user_id
      WHERE s.line_id = ? AND u.role_id = 1
      GROUP BY t.id, t.name
    `;

    // 4. Activity Log ล่าสุด
    const sqlActivities = `
      SELECT 
        u.first_name,
        u.last_name,
        cr.title AS course_title,
        es.status,
        es.score,
        es.tested_at
      FROM exam_scores es
      JOIN users u ON es.user_id = u.id
      JOIN teams t ON u.team_id = t.id
      JOIN sections s ON t.section_id = s.id
      JOIN lines l ON s.line_id = l.id
      JOIN courses cr ON es.course_id = cr.id
      ${filterCondition}
      ORDER BY es.tested_at DESC
      LIMIT 6
    `;

    db.all(sqlMembers, params, (err, memberRows) => {
      if (err) return res.status(500).json({ success: false, message: err.message });

      db.all(sqlTopFailed, params, (err2, topFailedRows) => {
        if (err2) return res.status(500).json({ success: false, message: err2.message });

        db.all(sqlTeamCompare, [boundLineId], (err3, teamCompareRows) => {
          if (err3) return res.status(500).json({ success: false, message: err3.message });

          db.all(sqlActivities, params, (err4, activityRows) => {
            if (err4) return res.status(500).json({ success: false, message: err4.message });

            res.json({
              success: true,
              members: memberRows || [],
              topFailed: topFailedRows || [],
              teamCompare: teamCompareRows || [],
              activities: activityRows || []
            });
          });
        });
      });
    });
  });
});

app.get('/api/supervisor/dashboard/:supervisorId', (req, res) => {
  const { supervisorId } = req.params;

  const checkRoleSql = `SELECT id, role_id FROM users WHERE id = ?`;

  db.get(checkRoleSql, [supervisorId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
    }

    if (user.role_id !== 3) {
      return res.status(403).json({ success: false, message: 'ปฏิเสธการเข้าถึง: สำหรับหัวหน้างานเท่านั้น' });
    }

    const sql = `
      SELECT 
        u.id AS employee_id,
        u.employee_code,
        u.first_name,
        u.last_name,
        u.position,
        t.name AS team_name,
        s.name AS section_name,
        l.name AS line_name,
        c.title AS course_title,
        es.score,
        es.status,
        es.tested_at
      FROM users u
      JOIN teams t ON t.id = u.team_id
      JOIN sections s ON s.id = t.section_id
      JOIN lines l ON l.id = s.line_id
      LEFT JOIN exam_scores es ON es.user_id = u.id
      LEFT JOIN courses c ON c.id = es.course_id
      WHERE u.role_id = 1 
        AND s.line_id = (
          SELECT s2.line_id 
          FROM users u2
          JOIN teams t2 ON t2.id = u2.team_id
          JOIN sections s2 ON s2.id = t2.section_id
          WHERE u2.id = ?
        )
      ORDER BY u.id ASC, c.id ASC
    `;

    db.all(sql, [supervisorId], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      res.json({
        success: true,
        data: rows
      });
    });
  });
});

// API สำหรับ Supervisor กดรีเซ็ตรหัสผ่านของพนักงานในสังกัด
app.post('/api/supervisor/reset-user-password', async (req, res) => {
  const { supervisor_id, target_user_id } = req.body;

  if (!supervisor_id || !target_user_id) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  // 1. ตรวจสอบสิทธิ์: เช็กว่า Supervisor และ Operator อยู่ใน Line เดียวกันหรือไม่
  const checkScopeSql = `
    SELECT 
      sup.id AS supervisor_id,
      tar.id AS target_user_id,
      tar.employee_code AS target_employee_code
    FROM users sup
    JOIN teams st ON sup.team_id = st.id
    JOIN sections ss ON st.section_id = ss.id
    JOIN lines sl ON ss.line_id = sl.id
    JOIN users tar ON tar.id = ?
    JOIN teams tt ON tar.team_id = tt.id
    JOIN sections ts ON tt.section_id = ts.id
    WHERE sup.id = ? AND ts.line_id = sl.id
  `;

  db.get(checkScopeSql, [target_user_id, supervisor_id], async (err, row) => {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (!row) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์รีเซ็ตรหัสผ่านของพนักงานนอกสายการผลิตของคุณ' });
    }

    try {
      // 2. กำหนดรหัสผ่านเริ่มต้น (Default Password) เช่น "123456" หรือ "pass_" ตามด้วยรหัสพนักงาน
      const defaultPassword = `pass_${row.target_employee_code.toLowerCase().replace('-', '')}`;
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      // 3. อัปเดตรหัสผ่านลงฐานข้อมูล
      const updateSql = `UPDATE users SET password = ? WHERE id = ?`;
      db.run(updateSql, [hashedPassword, target_user_id], (updateErr) => {
        if (updateErr) {
          return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตรหัสผ่าน' });
        }

        res.json({
          success: true,
          message: `รีเซ็ตรหัสผ่านสำเร็จ! รหัสผ่านชั่วคราวคือ: ${defaultPassword}`,
          temp_password: defaultPassword
        });
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend Server กำลังรันที่ http://localhost:${port}`);
});