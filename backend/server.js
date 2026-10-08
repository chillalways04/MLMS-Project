require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path'); 
const bcrypt = require('bcryptjs'); 
const helmet = require('helmet');                   
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid'); 
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET;

if (!SECRET_KEY || Buffer.byteLength(SECRET_KEY, 'utf8') < 32) {
  throw new Error('กรุณาตั้ง JWT_SECRET แบบสุ่มอย่างน้อย 32 bytes ในไฟล์ .env');
}

const JWT_ISSUER = 'training-api';
const JWT_AUDIENCE = 'training-client';

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[INCOMING REQUEST] ${req.method} ${req.url} - เวลา: ${new Date().toLocaleTimeString()}`);
  next();
});

app.set('trust proxy', 1);

// ป้องกัน Brute-force การสุ่มรหัสผ่าน
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { 
    success: false, 
    message: 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง' 
  }
});

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
    console.error(
      'Database connection error:',
      err.message
    );

    process.exit(1);
    return;
  }

  console.log('Connect to Database.');

  db.serialize(() => {
    // เปิดใช้งาน Foreign Key
    db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
      if (pragmaErr) {
        console.error(
          'เปิด Foreign Key ล้มเหลว:',
          pragmaErr.message
        );
      } else {
        console.log(
          'เปิดใช้งาน Foreign Key สำเร็จ'
        );
      }
    });

    // ป้องกัน 1 คนมี Certificate ซ้ำในคอร์สเดียวกัน
    // คำสั่งนี้ไม่ลบ Certificate
    db.run(
      `
        CREATE UNIQUE INDEX IF NOT EXISTS
        idx_cert_user_course
        ON certificates(user_id, course_id)
      `,
      (idxErr) => {
        if (idxErr) {
          console.error(
            'ตรวจสอบ Unique Index ล้มเหลว:',
            idxErr.message
          );

          console.error(
            'อาจมี Certificate ซ้ำอยู่ในฐานข้อมูล กรุณาตรวจสอบก่อน'
          );
        } else {
          console.log(
            'ตรวจสอบ Unique Index certificates สำเร็จ'
          );
        }
      }
    );
  });
});

// ตรวจสอบ Token และดึงข้อมูลผู้ใช้
function authenticateToken(req, res, next) {
  const authorization = req.get('Authorization');
  const match = typeof authorization === 'string'
    ? /^Bearer\s+(\S+)$/i.exec(authorization)
    : null;

  if (!match) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน'
    });
  }

  let payload;
  try {
    payload = jwt.verify(match[1], SECRET_KEY, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !/^[1-9]\d*$/.test(payload.sub) ||
      !Number.isSafeInteger(Number(payload.sub)) ||
      !Number.isInteger(payload.exp)
    ) {
      throw new Error('Invalid token claims');
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'การเข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่'
    });
  }

  const sql = `
    SELECT id, role_id, team_id, employee_code, first_name, last_name, position
    FROM users
    WHERE id = ?
  `;

  db.get(sql, [payload.sub], (err, user) => {
    if (err) {
      console.error('Authentication database error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถตรวจสอบผู้ใช้ได้'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่'
      });
    }

    req.user = user;
    next();
  });
}

function requireSupervisor(req, res, next) {
  if (Number(req.user.role_id) !== 3) {
    return res.status(403).json({
      success: false,
      message: 'สำหรับหัวหน้างานเท่านั้น'
    });
  }
  next();
}

function requireOwnUserId(req, res, next) {
  if (req.params.userId !== String(req.user.id)) {
    return res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลผู้ใช้อื่น'
    });
  }
  next();
}

function requireOwnSupervisorId(req, res, next) {
  if (req.params.supervisorId !== String(req.user.id)) {
    return res.status(403).json({
      success: false,
      message: 'ไม่มีสิทธิ์เข้าถึงข้อมูลหัวหน้างานอื่น'
    });
  }
  next();
}

/* ==========================================================================
   PUBLIC ROUTES
   ========================================================================== */

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
    res.json({ success: true, data: rows });
  });
});

// LOGIN: ไม่ JOIN ตาราง certificates เพื่อป้องกันข้อมูลหลักสูตรสับสน
app.post('/api/login', loginLimiter, (req, res) => {
  const { employee_code, password } = req.body;
  
  if (!employee_code || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสพนักงานและรหัสผ่าน' });
  }

  const sql = `SELECT * FROM users WHERE employee_code = ?`;
        
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
        team_id: user.team_id
      };

      const token = jwt.sign({}, SECRET_KEY, {
        algorithm: 'HS256',
        subject: String(user.id),
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '8h'
      });

      res.set('Cache-Control', 'no-store');

      return res.json({
        success: true,
        message: 'เข้าสู่ระบบสำเร็จ',
        token,
        token_type: 'Bearer',
        expires_in: 28800,
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

  const roleId = 1;
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
      employee_code.trim(),
      first_name.trim(),
      last_name.trim(),
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

// ตรวจสอบใบเซอร์ผ่าน QR Code
app.get('/api/verify-cert/:uuid', verifyLimiter, (req, res) => {
  const { uuid } = req.params;
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
    JOIN users u ON c.user_id = u.id
    JOIN courses cr ON c.course_id = cr.id
    WHERE c.uuid = ?
  `;

  db.get(sql, [uuid], (err, certData) => {
    if (err) {
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดภายในระบบฐานข้อมูล" });
    }

    if (!certData) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลใบประกาศนียบัตรนี้ในระบบ" });
    }

    res.json({ success: true, data: certData });
  });
});

/* ==========================================================================
   PROTECTED ROUTES
   ========================================================================== */

// ดึงรายละเอียดใบเซอร์สำหรับแสดงผลหน้า Certificate.jsx
app.get('/api/certificates/:uuid', authenticateToken, (req, res) => {
  const { uuid } = req.params;
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
    JOIN users u ON c.user_id = u.id
    JOIN courses cr ON c.course_id = cr.id
    WHERE c.uuid = ?
  `;

  db.get(sql, [uuid], (err, certData) => {
    if (err) {
      return res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในฐานข้อมูล" });
    }

    if (!certData) {
      return res.status(404).json({ success: false, message: "ไม่พบใบประกาศนียบัตรนี้" });
    }

    res.json({ success: true, data: certData });
  });
});

// Dashboard พนักงาน: ใช้ ON CONFLICT DO NOTHING ป้องกันใบเซอร์ซ้ำ
app.get('/api/user-dashboard/:userId',authenticateToken,requireOwnUserId,(req, res) => {
    const userId = req.user.id;

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
      LEFT JOIN certificates c
        ON c.user_id = es.user_id
        AND c.course_id = es.course_id
      WHERE es.user_id = ?
      ORDER BY es.id DESC
    `;

    db.all(sql, [userId], async (err, rows) => {
      if (err) {
        console.error('Fetch dashboard error:', err.message);

        return res.status(500).json({
          success: false,
          message: 'ไม่สามารถดึงข้อมูลผลสอบได้'
        });
      }

      try {
        const processedList = [];

        for (const row of rows) {
          const score = Number(row.score);
          const status = String(row.status ?? '')
            .trim()
            .toLowerCase();

          // ต้องได้คะแนนอย่างน้อย 80 และมีสถานะผ่าน
          const isPassed =
            Number.isFinite(score) &&
            score >= 80 &&
            ['completed', 'pass'].includes(status);

          let certUuid = row.cert_uuid ?? null;
          let verificationCode = row.verification_code ?? null;
          let issuedAt = row.issued_at ?? null;

          if (isPassed && !certUuid) {
            const newUuid = uuidv4();
            const year = new Date().getFullYear();

            const newVerificationCode =
              `CERT-${year}-${newUuid.slice(0, 8).toUpperCase()}`;

            // คงรูปแบบวันที่เดิมให้หน้าเว็บยังแสดงได้เหมือนเดิม
            const newIssuedAt = new Date().toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            const pdfUrl = `/certificates/${newUuid}.pdf`;

            const insertCertSql = `
              INSERT INTO certificates (
                uuid,
                verification_code,
                user_id,
                course_id,
                pdf_url,
                issued_at
              )
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, course_id) DO NOTHING
            `;

            await new Promise((resolve, reject) => {
              db.run(
                insertCertSql,
                [
                  newUuid,
                  newVerificationCode,
                  userId,
                  row.course_id,
                  pdfUrl,
                  newIssuedAt
                ],
                function (insertErr) {
                  if (insertErr) {
                    return reject(insertErr);
                  }

                  resolve();
                }
              );
            });

            // อ่านใบที่มีอยู่จริง ทั้งกรณีสร้างใหม่และมีใบเดิมแล้ว
            const savedCert = await new Promise((resolve, reject) => {
              db.get(
                `
                  SELECT uuid, verification_code, issued_at
                  FROM certificates
                  WHERE user_id = ? AND course_id = ?
                `,
                [userId, row.course_id],
                (readErr, certificate) => {
                  if (readErr) {
                    return reject(readErr);
                  }

                  if (!certificate) {
                    return reject(
                      new Error('Certificate not found after insert')
                    );
                  }

                  resolve(certificate);
                }
              );
            });

            // ใช้เฉพาะข้อมูลที่อ่านได้จริงจากฐานข้อมูล
            certUuid = savedCert.uuid;
            verificationCode = savedCert.verification_code;
            issuedAt = savedCert.issued_at;
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

        return res.json({
          success: true,
          data: processedList
        });
      } catch (error) {
        console.error('Process dashboard error:', error.message);

        return res.status(500).json({
          success: false,
          message: 'ไม่สามารถประมวลผลข้อมูลใบรับรองได้ กรุณาลองใหม่'
        });
      }
    });
  }
);

// ดึงสรุปข้อมูลของ Supervisor
app.get(
  '/api/supervisor/dashboard-summary',
  authenticateToken,
  requireSupervisor,
  async (req, res) => {
    const supervisorId = req.user.id;
    const { section_id, team_id } = req.query;

    // ไม่เลือกตัวกรองได้ แต่ถ้าระบุต้องเป็นจำนวนเต็มบวก
    const isValidOptionalId = (value) =>
      value === undefined ||
      value === '' ||
      (
        typeof value === 'string' &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value))
      );

    if (
      !isValidOptionalId(section_id) ||
      !isValidOptionalId(team_id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'รหัสแผนกหรือทีมไม่ถูกต้อง'
      });
    }

    const sectionId = section_id ? Number(section_id) : null;
    const teamId = team_id ? Number(team_id) : null;

    // ใช้ Promise เพื่อให้จัดการข้อผิดพลาดรวมใน try/catch ได้
    const getRow = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });

    const getRows = (sql, params = []) =>
      new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

    try {
      // หาสายการผลิตจากบัญชีจริง ไม่รับจาก Frontend
      const supervisor = await getRow(
        `
          SELECT s.line_id
          FROM users u
          JOIN teams t ON t.id = u.team_id
          JOIN sections s ON s.id = t.section_id
          WHERE u.id = ? AND u.role_id = 3
        `,
        [supervisorId]
      );

      if (!supervisor) {
        return res.status(403).json({
          success: false,
          message: 'ไม่พบสายการผลิตที่คุณมีสิทธิ์เข้าถึง'
        });
      }

      const boundLineId = supervisor.line_id;

      // ตรวจว่าแผนกอยู่ในสายการผลิตที่รับผิดชอบ
      if (sectionId !== null) {
        const section = await getRow(
          `
            SELECT id
            FROM sections
            WHERE id = ? AND line_id = ?
          `,
          [sectionId, boundLineId]
        );

        if (!section) {
          return res.status(403).json({
            success: false,
            message: 'แผนกที่เลือกไม่อยู่ในขอบเขตที่คุณเข้าถึงได้'
          });
        }
      }

      // ตรวจขอบเขตทีม และความสัมพันธ์กับแผนกที่เลือก
      if (teamId !== null) {
        const team = await getRow(
          `
            SELECT t.id, t.section_id
            FROM teams t
            JOIN sections s ON s.id = t.section_id
            WHERE t.id = ? AND s.line_id = ?
          `,
          [teamId, boundLineId]
        );

        if (!team) {
          return res.status(403).json({
            success: false,
            message: 'ทีมที่เลือกไม่อยู่ในขอบเขตที่คุณเข้าถึงได้'
          });
        }

        if (
          sectionId !== null &&
          Number(team.section_id) !== sectionId
        ) {
          return res.status(400).json({
            success: false,
            message: 'ทีมที่เลือกไม่อยู่ในแผนกที่ระบุ'
          });
        }
      }

      // ใช้ตัวกรองเดียวกันกับข้อมูลทั้ง 4 ส่วน
      let filterCondition = `
        WHERE u.role_id = 1
          AND s.line_id = ?
      `;

      const params = [boundLineId];

      if (sectionId !== null) {
        filterCondition += ' AND s.id = ?';
        params.push(sectionId);
      }

      if (teamId !== null) {
        filterCondition += ' AND t.id = ?';
        params.push(teamId);
      }

      const passCondition = `
        es.score >= 80
        AND LOWER(TRIM(es.status)) IN ('completed', 'pass')
      `;

      // ไม่นับสถานะรอสอบ/รอผลเป็นสอบตก
      const failCondition = `
        LOWER(TRIM(es.status)) IN ('failed', 'fail')
        OR (
          es.score < 80
          AND LOWER(TRIM(es.status)) IN ('completed', 'pass')
        )
      `;

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
        JOIN teams t ON t.id = u.team_id
        JOIN sections s ON s.id = t.section_id
        JOIN lines l ON l.id = s.line_id
        LEFT JOIN exam_scores es ON es.user_id = u.id
        LEFT JOIN courses cr ON cr.id = es.course_id
        LEFT JOIN certificates c
          ON c.user_id = u.id
          AND c.course_id = cr.id
        ${filterCondition}
        ORDER BY u.id ASC, es.tested_at DESC, es.id DESC
      `;

      const sqlTopFailed = `
        SELECT
          cr.title AS course_title,
          COUNT(es.id) AS fail_count
        FROM exam_scores es
        JOIN users u ON u.id = es.user_id
        JOIN teams t ON t.id = u.team_id
        JOIN sections s ON s.id = t.section_id
        JOIN courses cr ON cr.id = es.course_id
        ${filterCondition}
          AND (${failCondition})
        GROUP BY cr.id, cr.title
        ORDER BY fail_count DESC, cr.id ASC
        LIMIT 5
      `;

      const sqlTeamCompare = `
        SELECT
          t.name AS team_name,
          COUNT(DISTINCT u.id) AS total_members,
          COUNT(
            CASE
              WHEN ${passCondition} THEN 1
            END
          ) AS passed_records,
          COUNT(es.id) AS total_exams,
          AVG(es.score) AS avg_score
        FROM teams t
        JOIN sections s ON s.id = t.section_id
        JOIN users u ON u.team_id = t.id
        LEFT JOIN exam_scores es ON es.user_id = u.id
        ${filterCondition}
        GROUP BY t.id, t.name
        ORDER BY t.id ASC
      `;

      const sqlActivities = `
        SELECT
          u.first_name,
          u.last_name,
          cr.title AS course_title,
          es.status,
          es.score,
          es.tested_at
        FROM exam_scores es
        JOIN users u ON u.id = es.user_id
        JOIN teams t ON t.id = u.team_id
        JOIN sections s ON s.id = t.section_id
        JOIN courses cr ON cr.id = es.course_id
        ${filterCondition}
        ORDER BY es.tested_at DESC, es.id DESC
        LIMIT 6
      `;

      const [
        memberRows,
        topFailedRows,
        teamCompareRows,
        activityRows
      ] = await Promise.all([
        getRows(sqlMembers, params),
        getRows(sqlTopFailed, params),
        getRows(sqlTeamCompare, params),
        getRows(sqlActivities, params)
      ]);

      res.set('Cache-Control', 'no-store');

      return res.json({
        success: true,
        members: memberRows,
        topFailed: topFailedRows,
        teamCompare: teamCompareRows,
        activities: activityRows
      });
    } catch (error) {
      console.error(
        'Supervisor dashboard-summary error:',
        error.message
      );

      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถดึงข้อมูลสรุปได้ กรุณาลองใหม่'
      });
    }
  }
);

app.get('/api/supervisor/dashboard/:supervisorId', authenticateToken, requireSupervisor, requireOwnSupervisorId, (req, res) => {
  const supervisorId = req.user.id;
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
    res.json({ success: true, data: rows });
  });
});

// API สำหรับ Supervisor รีเซ็ตรหัสผ่านพนักงาน
app.post('/api/supervisor/reset-user-password', authenticateToken, requireSupervisor, async (req, res) => {
  const supervisor_id = req.user.id;
  const { target_user_id } = req.body || {};

  if (!target_user_id) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุ target_user_id' });
  }

  const checkScopeSql = `
    SELECT 
      sup.id AS supervisor_id,
      sup.employee_code AS supervisor_code,
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
      return res.status(403).json({ 
        success: false, 
        message: 'คุณไม่มีสิทธิ์รีเซ็ตรหัสผ่านของพนักงานนอกสายการผลิตของคุณ' 
      });
    }

    try {
      const defaultPassword = `pass_${String(row.target_employee_code || '').toLowerCase().replace('-', '')}`;
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const updateSql = `UPDATE users SET password = ? WHERE id = ?`;
      db.run(updateSql, [hashedPassword, target_user_id], function (updateErr) {
        if (updateErr) {
          return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตรหัสผ่าน' });
        }

        const logSql = `
          INSERT INTO activities (user_id, activity_type, description, created_at)
          VALUES (?, 'RESET_PASSWORD', ?, datetime('now', 'localtime'))
        `;
        const logDesc = `Supervisor ${row.supervisor_code} ได้ทำการรีเซ็ตรหัสผ่านให้แก่ ${row.target_employee_code}`;

        db.run(logSql, [target_user_id, logDesc], (logErr) => {
          if (logErr) {
            console.error('Audit Log Error:', logErr.message);
          }

          return res.json({
            success: true,
            message: `รีเซ็ตรหัสผ่านสำเร็จ! รหัสผ่านชั่วคราวคือ: ${defaultPassword}`,
            temp_password: defaultPassword
          });
        });
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend Server กำลังรันที่ http://localhost:${port}`);
});

