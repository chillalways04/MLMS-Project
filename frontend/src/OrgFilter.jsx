import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import './OrgFilter.css';

const API_BASE = "";

function OrgFilter() {
  const navigate = useNavigate();

  const [user] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // State สำหรับ Dropdown ตัวกรองโครงสร้างองค์กร
  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState([]);
  const [teams, setTeams] = useState([]);

  // กำหนดค่าเริ่มต้นว่างไว้ทั้งหมด เพื่อให้ตอนล็อกอินเข้ามาเปิดหน้า Welcome ทันที
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  // State ข้อมูลสายงานจริงของ Supervisor
  const [myScope, setMyScope] = useState(null);

  // State ข้อมูลจาก Backend
  const [rawMembers, setRawMembers] = useState([]);
  const [topFailedCourses, setTopFailedCourses] = useState([]);
  const [teamCompare, setTeamCompare] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Helper สำหรับดึง Header พร้อม Bearer Token
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }, []);

  // 1. ดึงสายงานจริงของ Supervisor
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user?.id || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
      return;
    }

    if (Number(user.role_id) !== 3) {
      navigate("/dashboard", { replace: true });
      return;
    }

    fetch(`${API_BASE}/api/lines?user_id=${user.id}`, {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMyScope({
            line_id: String(data[0].id),
            line_name: data[0].name,
            team_id: String(user.team_id)
          });
        }
      })
      .catch((err) => console.error("Error fetching supervisor scope:", err));
  }, [user, navigate, getAuthHeaders]);

  // 2. ดึงรายการ Line ทั้งหมดในระบบ
  useEffect(() => {
    fetch(`${API_BASE}/api/lines`, {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLines(data);
        }
      })
      .catch((err) => console.error("Error all lines:", err));
  }, [getAuthHeaders]);

  // 3. ดึง Section ตาม Line ที่เลือก
  useEffect(() => {
    if (!selectedLine) return;

    fetch(`${API_BASE}/api/sections?line_id=${selectedLine}`, {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => setSections(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error sections:", err));
  }, [selectedLine, getAuthHeaders]);

  // 4. ดึง Team ตาม Section ที่เลือก
  useEffect(() => {
    if (!selectedSection) return;

    fetch(`${API_BASE}/api/teams?section_id=${selectedSection}`, {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error teams:", err));
  }, [selectedSection, getAuthHeaders]);

  // แยกสถานะการเลือกแบบ Derived State:
  // 1. ยังเลือกไม่ครบ (หน้า Welcome)
  const isPendingSelection = !selectedLine || !selectedSection || !selectedTeam;

  // 2. เลือกครบแล้วแต่ข้ามสายงาน (หน้าเตือนไม่มีสิทธิ์)
  const isForbidden =
    !isPendingSelection &&
    myScope &&
    (selectedLine !== myScope.line_id || selectedTeam !== myScope.team_id);

  // 3. เลือกถูกต้องตรงสายงานของตนเอง (พร้อมดึงข้อมูล)
  const isAuthorized = !isPendingSelection && !isForbidden;

  // 5. ดึงข้อมูล Dashboard สรุปภาพรวมเมื่อเลือกสายงานถูกต้อง
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user?.id || !token || Number(user.role_id) !== 3) return;

    if (!isAuthorized) {
      return;
    }

    const controller = new AbortController();

    const fetchSummary = async () => {
      setLoadingData(true);

      try {
        const params = new URLSearchParams({
          section_id: selectedSection,
          team_id: selectedTeam
        });

        const url = `${API_BASE}/api/supervisor/dashboard-summary?${params.toString()}`;

        const response = await fetch(url, {
          headers: getAuthHeaders(),
          signal: controller.signal,
        });

        if (response.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          navigate("/login", { replace: true });
          return;
        }

        if (response.status === 403) {
          navigate("/dashboard", { replace: true });
          return;
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "โหลดข้อมูลหัวหน้างานไม่สำเร็จ");
        }

        if (!controller.signal.aborted) {
          setRawMembers(result.members || []);
          setTopFailedCourses(result.topFailed || []);
          setTeamCompare(result.teamCompare || []);
          setActivities(result.activities || []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Fetch summary error:", err);
          setRawMembers([]);
          setTopFailedCourses([]);
          setTeamCompare([]);
          setActivities([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingData(false);
        }
      }
    };

    fetchSummary();

    return () => {
      controller.abort();
    };
  }, [selectedLine, selectedSection, selectedTeam, isAuthorized, user, navigate, getAuthHeaders]);

  const handleLineChange = (e) => {
    setSelectedLine(e.target.value);
    setSelectedSection('');
    setSelectedTeam('');
    setSections([]);
    setTeams([]);
  };

  const handleSectionChange = (e) => {
    setSelectedSection(e.target.value);
    setSelectedTeam('');
    setTeams([]);
  };

  const handleTeamChange = (e) => {
    setSelectedTeam(e.target.value);
  };

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    }
  };

  // รีเซ็ตรหัสผ่านพนักงาน
  const handleResetEmployeePassword = async (targetUserId, employeeName) => {
    const token = localStorage.getItem("token");

    if (!user?.id || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
      return;
    }

    const confirmReset = window.confirm(`คุณต้องการรีเซ็ตรหัสผ่านของ "${employeeName}" ใช่หรือไม่?`);
    if (!confirmReset) return;

    try {
      const res = await fetch(`${API_BASE}/api/supervisor/reset-user-password`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_user_id: targetUserId,
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "ไม่สามารถรีเซ็ตรหัสผ่านได้");
      }

      alert(data.message || "รีเซ็ตรหัสผ่านสำเร็จ");
    } catch (err) {
      console.error("Reset employee password error:", err);
      alert(err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  // รวมกลุ่มพนักงานรายบุคคล
  const employeeList = useMemo(() => {
    if (!isAuthorized) return [];

    const map = new Map();
    rawMembers.forEach((item) => {
      if (!map.has(item.user_id)) {
        map.set(item.user_id, {
          user_id: item.user_id,
          employee_code: item.employee_code,
          first_name: item.first_name,
          last_name: item.last_name,
          position: item.position,
          courses: []
        });
      }
      if (item.course_title) {
        map.get(item.user_id).courses.push(item);
      }
    });

    return Array.from(map.values()).map((emp) => {
      const total = emp.courses.length;
      const passed = emp.courses.filter((c) => {
        const score = Number(c.score);
        const status = String(c.status ?? '').trim().toLowerCase();

        return (
          Number.isFinite(score) &&
          score >= 80 &&
          ['completed', 'pass'].includes(status)
        );
      }).length;

      const progress = total > 0 ? Math.round((passed / total) * 100) : 0;

      let status;
      let statusClass;

      if (progress === 100) {
        status = 'ครบถ้วน';
        statusClass = 'status-completed';
      } else if (progress >= 80) {
        status = 'ใกล้ครบ';
        statusClass = 'status-near';
      } else if (progress > 0) {
        status = 'กำลังดำเนินการ';
        statusClass = 'status-in-progress';
      } else {
        status = 'ยังไม่เริ่ม';
        statusClass = 'status-not-started';
      }

      return {
        ...emp,
        progress,
        status,
        statusClass,
        currentCourse: emp.courses[0]?.course_title || 'ไม่มีหลักสูตร'
      };
    });
  }, [rawMembers, isAuthorized]);

  // คำนวณ KPI สถิติ
  const totalEmployees = employeeList.length;
  const completedEmployees = employeeList.filter((e) => e.status === 'ครบถ้วน').length;
  const nearCompleteEmployees = employeeList.filter((e) => e.status === 'ใกล้ครบ').length;
  const inProgressEmployees = employeeList.filter((e) => e.status === 'กำลังดำเนินการ').length;
  const notStartedEmployees = employeeList.filter((e) => e.status === 'ยังไม่เริ่ม').length;
  const completionRate = totalEmployees > 0 ? Math.round((completedEmployees / totalEmployees) * 100) : 0;

  const scoredRecords = rawMembers.filter((m) => m.score !== null && m.score !== undefined);
  const avgScore = scoredRecords.length > 0 
    ? Math.round(scoredRecords.reduce((acc, cur) => acc + Number(cur.score), 0) / scoredRecords.length) 
    : 0;

  const lowScoreCount = employeeList.filter((e) => e.courses.some((c) => c.score !== null && c.score < 80)).length;

  const completePct = totalEmployees > 0 ? Math.round((completedEmployees / totalEmployees) * 100) : 0;
  const nearPct = totalEmployees > 0 ? Math.round((nearCompleteEmployees / totalEmployees) * 100) : 0;
  const inProgressPct = totalEmployees > 0 ? Math.round((inProgressEmployees / totalEmployees) * 100) : 0;
  const notStartedPct = totalEmployees > 0 ? Math.max(0, 100 - completePct - nearPct - inProgressPct) : 0;

  const p1 = completePct;
  const p2 = p1 + nearPct;
  const p3 = p2 + inProgressPct;

  const donutGradient = totalEmployees === 0
    ? '#e2e8f0'
    : `conic-gradient(
        #10b981 0% ${p1}%, 
        #f59e0b ${p1}% ${p2}%, 
        #3b82f6 ${p2}% ${p3}%, 
        #94a3b8 ${p3}% 100%
      )`;

  // กรองตารางลูกทีม
  const filteredTableData = employeeList.filter((emp) => {
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchSearch = name.includes(searchTerm.toLowerCase()) || emp.employee_code.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchSearch) return false;
    if (activeTab === 'completed') return emp.status === 'ครบถ้วน';
    if (activeTab === 'near') return emp.status === 'ใกล้ครบ';
    if (activeTab === 'in-progress') return emp.status === 'กำลังดำเนินการ';
    if (activeTab === 'not-started') return emp.status === 'ยังไม่เริ่ม';
    return true;
  });

  return (
    <div className="sv-dashboard-container">
      <header className="sv-header">
        <div className="sv-header-left">
          <div className="sv-header-icon">👥</div>
          <div>
            <h2 className="sv-header-title">Dashboard หัวหน้างาน</h2>
            <p className="sv-header-subtitle">
              ภาพรวมการเรียนรู้ของทีม {teams.find(t => String(t.id) === String(selectedTeam))?.name || 'ทุกทีม'} - {lines.find(l => String(l.id) === String(selectedLine))?.name || 'ทุกไลน์ผลิต'}
            </p>
          </div>
        </div>

        <div className="sv-header-right">
          {/* Dropdown Line */}
          <select 
            value={selectedLine} 
            onChange={handleLineChange} 
            className="sv-filter-btn"
          >
            <option value="">เลือกสายการผลิต (Line)</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Dropdown Section */}
          <select value={selectedSection} onChange={handleSectionChange} disabled={!selectedLine} className="sv-filter-btn">
            <option value="">เลือกแผนก (Section)</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Dropdown Team */}
          <select value={selectedTeam} onChange={handleTeamChange} disabled={!selectedSection} className="sv-filter-btn">
            <option value="">เลือกทีม (Team)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {user && (
            <div className="sv-user-profile">
              <div className="sv-user-avatar">
                {user.first_name ? user.first_name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div className="sv-user-info-text">
                <div className="sv-user-fullname">คุณ{user.first_name} {user.last_name}</div>
                <div className="sv-user-sub">{user.position} ({user.employee_code})</div>
              </div>
              <button className="btn-outline-danger-sm sv-logout-btn" onClick={handleLogout}>
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </header>

      {/* กรณีที่ 1: ผู้ใช้เลือกข้ามสายงาน (แสดงไอคอนห้ามเข้าสีแดง) */}
      {isForbidden ? (
        <div style={{
          margin: '40px auto',
          padding: '48px 24px',
          maxWidth: '560px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #fee2e2',
          boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '54px', marginBottom: '16px' }}>🚫</div>
          <h3 style={{ color: '#ef4444', fontSize: '20px', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            คุณไม่มีสิทธิ์ดูสายการผลิตอื่น
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>
            ท่านสามารถเข้าดูได้เฉพาะสายการผลิตและทีมที่ท่านรับผิดชอบเท่านั้น
          </p>
        </div>
      ) : isPendingSelection ? (
        /* กรณีที่ 2: เพิ่งล็อกอินเข้ามาหรือยังเลือกไม่ครบ (แสดงหน้ายินดีต้อนรับสีฟ้า) */
        <div style={{
          margin: '50px auto',
          padding: '56px 28px',
          maxWidth: '620px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid #e0f2fe',
          boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.08)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '58px', marginBottom: '16px' }}>👋</div>
          <h3 style={{ color: '#0369a1', fontSize: '22px', margin: '0 0 10px 0', fontWeight: 'bold' }}>
            ยินดีต้อนรับสู่แดชบอร์ดหัวหน้างาน
          </h3>
          <p style={{ color: '#64748b', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
            สวัสดีคุณ <b>{user?.first_name} {user?.last_name}</b><br />
            กรุณาเลือก <b>สายการผลิต (Line)</b>, <b>แผนก (Section)</b> และ <b>ทีม (Team)</b> ของท่านจากเมนูด้านบนขวาเพื่อเริ่มต้นดูข้อมูล
          </p>
        </div>
      ) : (
        /* กรณีที่ 3: เลือกสายงานของตนเองถูกต้อง (แสดงข้อมูลแดชบอร์ดทั้งหมด) */
        <>
          <section className="sv-kpi-grid">
            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-blue">👥</div>
                <div className="sv-kpi-title">พนักงานในทีม</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{totalEmployees}</span>
                <span className="sv-kpi-unit">คน</span>
              </div>
              <div className="sv-kpi-sub">ที่พบตามเงื่อนไข</div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-green">📊</div>
                <div className="sv-kpi-title">อัตราการเรียนครบ</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{completionRate}%</span>
              </div>
              <div className="sv-kpi-trend up">{completedEmployees} จาก {totalEmployees} คน</div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-orange">📖</div>
                <div className="sv-kpi-title">หลักสูตรที่ลงทะเบียน</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{new Set(rawMembers.map(m => m.course_title).filter(Boolean)).size}</span>
                <span className="sv-kpi-unit">วิชา</span>
              </div>
              <div className="sv-kpi-sub">
                ทั้งหมด {rawMembers.filter(m => m.course_title).length} รายการ
              </div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-red">⚠️</div>
                <div className="sv-kpi-title">กำลังดำเนินการ</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value value-danger">{inProgressEmployees}</span>
                <span className="sv-kpi-unit">คน</span>
              </div>
              <div className="sv-kpi-trend danger">คิดเป็น {totalEmployees > 0 ? Math.round((inProgressEmployees/totalEmployees)*100) : 0}% ของทีม</div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-purple">⏱️</div>
                <div className="sv-kpi-title">ใบเซอร์ที่ออกแล้ว</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{rawMembers.filter(m => m.verification_code).length}</span>
                <span className="sv-kpi-unit">ใบ</span>
              </div>
              <div className="sv-kpi-sub">พร้อมใช้งาน</div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-blue">🛡️</div>
                <div className="sv-kpi-title">คะแนนเฉลี่ยแบบทดสอบ</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{avgScore}%</span>
              </div>
              <div className="sv-kpi-trend up">จากแบบทดสอบทั้งหมด</div>
            </div>

            <div className="sv-kpi-card">
              <div className="sv-kpi-top">
                <div className="sv-kpi-icon icon-green">✅</div>
                <div className="sv-kpi-title">การประเมินผ่านเกณฑ์</div>
              </div>
              <div className="sv-kpi-value-row">
                <span className="sv-kpi-value">{completionRate}%</span>
              </div>
              <div className="sv-kpi-trend up">ผ่านเกณฑ์มาตรฐาน</div>
            </div>
          </section>

          <section className="sv-row-analytics">
            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">แนวโน้มการเรียนรู้ของทีม</span>
                <span className="sv-card-meta">ภาพรวม</span>
              </div>
              <div className="sv-trend-chart-area">
                {[
                  { m: 'ก.พ.', v: 67 },
                  { m: 'มี.ค.', v: 72 },
                  { m: 'เม.ย.', v: 74 },
                  { m: 'ปัจจุบัน', v: completionRate || 80 }
                ].map((item, idx) => (
                  <div key={idx} className="sv-trend-bar-col">
                    <span className="sv-trend-bar-val">{item.v}%</span>
                    <div className="sv-trend-bar" style={{ height: `${item.v}px` }}></div>
                    <span className="sv-trend-bar-label">{item.m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">สถานะการอบรม (ภาพรวม)</span>
              </div>
              <div className="sv-mandatory-box">
                <div className="sv-donut-chart" style={{ background: donutGradient }}>
                  <div className="sv-donut-inner">
                    <strong className="sv-donut-percent">{completePct}%</strong>
                    <small className="sv-donut-sub">ครบถ้วน</small>
                  </div>
                </div>
                <div className="sv-donut-legend">
                  <div className="sv-legend-row">
                    <span className="sv-legend-label">🟢 ครบถ้วน</span>
                    <span className="sv-legend-value"><b>{completedEmployees} คน</b> ({completePct}%)</span>
                  </div>
                  <div className="sv-legend-row">
                    <span className="sv-legend-label">🟡 ใกล้ครบ</span>
                    <span className="sv-legend-value"><b>{nearCompleteEmployees} คน</b> ({nearPct}%)</span>
                  </div>
                  <div className="sv-legend-row">
                    <span className="sv-legend-label">🔵 กำลังดำเนินการ</span>
                    <span className="sv-legend-value"><b>{inProgressEmployees} คน</b> ({inProgressPct}%)</span>
                  </div>
                  <div className="sv-legend-row">
                    <span className="sv-legend-label">⚪ ยังไม่เริ่ม</span>
                    <span className="sv-legend-value"><b>{notStartedEmployees} คน</b> ({notStartedPct}%)</span>
                  </div>
                </div>
              </div>
              <button className="sv-btn-action-primary" onClick={() => setActiveTab('all')}>ดูรายละเอียดทั้งหมด</button>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">วิชาที่ต้องติดตามเร่งด่วน</span>
              </div>
              <div className="sv-urgent-list">
                {topFailedCourses.length === 0 ? (
                  <div className="text-muted" style={{ padding: '10px 0' }}>ไม่มีวิชาที่ต้องซ่อม</div>
                ) : (
                  topFailedCourses.slice(0, 3).map((c, idx) => (
                    <div key={idx} className="sv-urgent-row">
                      <div className="sv-urgent-content">
                        <div className="sv-urgent-title">
                          <span>⚠️</span>
                          <span className="sv-urgent-name" title={c.course_title}>{c.course_title}</span>
                        </div>
                        <div className="sv-urgent-subtitle">ต้องสอบแก้ตัว</div>
                      </div>
                      <div className="sv-urgent-badge">
                        <span className="sv-urgent-num">{c.fail_count}</span>
                        <span className="sv-urgent-unit">คน</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sv-card sv-pending-card">
              <div className="sv-card-header">
                <span className="sv-card-title text-pending-title">🔔 Pending (รอดำเนินการ)</span>
              </div>
              <div className="sv-pending-list">
                <div className="sv-pending-item">
                  <span>› รอการสอบซ่อม</span>
                  <b>{topFailedCourses.reduce((acc, cur) => acc + (cur.fail_count || 0), 0)} คน</b>
                </div>
                <div className="sv-pending-item">
                  <span>› คะแนนต่ำกว่าเกณฑ์</span>
                  <b>{lowScoreCount} คน</b>
                </div>
                <div className="sv-pending-item">
                  <span>› ใบเซอร์ที่ยังไม่ออก</span>
                  <b>{rawMembers.filter(m => !m.verification_code).length} รายการ</b>
                </div>
              </div>
              <button className="sv-btn-action-orange" onClick={() => setActiveTab('in-progress')}>ติดตามผลลูกทีม</button>
            </div>
          </section>

          <section className="sv-row-details">
            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">สถานะการเรียนรู้ของพนักงานในทีม</span>
                <input 
                  type="text" 
                  placeholder="🔍 ค้นหารหัส / ชื่อพนักงาน..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="sv-search-input"
                />
              </div>

              {/* Filter Pills */}
              <div className="sv-tab-pills">
                <button onClick={() => setActiveTab('all')} className={`sv-tab-btn ${activeTab === 'all' ? 'active' : ''}`}>
                  ทั้งหมด {employeeList.length}
                </button>
                <button onClick={() => setActiveTab('completed')} className={`sv-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}>
                  ครบถ้วน {completedEmployees}
                </button>
                <button onClick={() => setActiveTab('near')} className={`sv-tab-btn ${activeTab === 'near' ? 'active' : ''}`}>
                  ใกล้ครบ {nearCompleteEmployees}
                </button>
                <button onClick={() => setActiveTab('in-progress')} className={`sv-tab-btn ${activeTab === 'in-progress' ? 'active' : ''}`}>
                  กำลังดำเนินการ {inProgressEmployees}
                </button>
                <button onClick={() => setActiveTab('not-started')} className={`sv-tab-btn ${activeTab === 'not-started' ? 'active' : ''}`}>
                  ยังไม่เริ่ม {notStartedEmployees}
                </button>
              </div>

              <div className="sv-table-scroll-container">
                <table className="sv-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>รหัส</th>
                      <th>ชื่อ-นามสกุล</th>
                      <th>ความคืบหน้า</th>
                      <th>วิชาล่าสุด</th>
                      <th>สถานะ</th>
                      <th style={{ textAlign: 'center' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingData ? (
                      <tr><td colSpan="7" className="sv-table-empty">กำลังโหลดข้อมูล...</td></tr>
                    ) : filteredTableData.length === 0 ? (
                      <tr><td colSpan="7" className="sv-table-empty">ไม่พบข้อมูลพนักงาน</td></tr>
                    ) : (
                      filteredTableData.map((emp, idx) => (
                        <tr key={idx}>
                          <td>{idx + 1}</td>
                          <td className="font-bold">{emp.employee_code}</td>
                          <td>{emp.first_name} {emp.last_name}</td>
                          <td>
                            <div className="sv-table-progress-box">
                              <div className="sv-table-progress-bg">
                                <div 
                                  className={`sv-table-progress-fill ${emp.progress === 100 ? 'fill-green' : emp.progress >= 50 ? 'fill-blue' : 'fill-orange'}`}
                                  style={{ width: `${emp.progress}%` }}
                                ></div>
                              </div>
                              <span className="sv-table-progress-text">{emp.progress}%</span>
                            </div>
                          </td>
                          <td className="sv-course-title-cell">{emp.currentCourse}</td>
                          <td>
                            <span className={`sv-status-pill ${emp.statusClass}`}>
                              {emp.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="sv-btn-reset-pwd"
                              onClick={() => handleResetEmployeePassword(emp.user_id, `${emp.first_name} ${emp.last_name}`)}
                              title="รีเซ็ตรหัสผ่านเป็นค่าเริ่มต้น"
                            >
                              🔑 รีเซ็ตรหัส
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">เปรียบเทียบทีมในแผนกเดียวกัน</span>
                <span className="sv-card-meta">รายเดือน ▾</span>
              </div>

              <div className="sv-compare-container">
                <div className="sv-compare-chart-area">
                  {teamCompare.length > 0 ? (
                    Array.from(new Map(teamCompare.map(t => [t.team_name, t])).values()).map((t, idx) => {
                      const compRate = t.total_exams > 0 ? Math.round((t.passed_records / t.total_exams) * 100) : 0;
                      const passScore = t.avg_score ? Math.round(t.avg_score) : 0;

                      const greenHeight = Math.max(6, Math.round((compRate / 100) * 140));
                      const blueHeight = Math.max(6, Math.round((passScore / 100) * 140));

                      return (
                        <div key={idx} className="sv-compare-col">
                          <div className="sv-bar-group">
                            <div className="sv-bar-wrapper">
                              <span className="sv-bar-tooltip">{compRate}%</span>
                              <div className="sv-bar-val fill-green" style={{ height: `${greenHeight}px` }}></div>
                            </div>

                            <div className="sv-bar-wrapper">
                              <span className="sv-bar-tooltip">{passScore}%</span>
                              <div className="sv-bar-val fill-blue" style={{ height: `${blueHeight}px` }}></div>
                            </div>
                          </div>
                          <div className="sv-compare-label">{t.team_name}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-muted" style={{ margin: 'auto', padding: '40px 0' }}>ไม่มีข้อมูลทีมอื่น</div>
                  )}
                </div>

                <div className="sv-compare-legends">
                  <span><i className="legend-dot dot-green"></i> Completion Rate (%)</span>
                  <span><i className="legend-dot dot-blue"></i> Pass Rate / Score (%)</span>
                </div>
              </div>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">หลักสูตรที่มีผู้สอบตกมากที่สุด</span>
              </div>
              <div className="sv-fail-courses-list">
                {topFailedCourses.length === 0 ? (
                  <div className="text-muted" style={{ padding: '10px 0' }}>ไม่มีประวัติการสอบตก</div>
                ) : (
                  topFailedCourses.map((item, idx) => (
                    <div key={idx} className="sv-fail-course-item">
                      <span>{idx + 1}. {item.course_title}</span>
                      <b className="text-danger">{item.fail_count} คน</b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="sv-row-risks">
            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">การแจ้งเตือนและความเสี่ยง</span>
              </div>
              <div className="sv-mini-risk-grid">
                <div className="sv-mini-risk-box red">
                  <span className="risk-icon">⚠️</span>
                  <b className="risk-value">{inProgressEmployees} คน</b>
                  <small>กำลังเรียน</small>
                </div>
                <div className="sv-mini-risk-box orange">
                  <span className="risk-icon">⏱️</span>
                  <b className="risk-value">{nearCompleteEmployees} คน</b>
                  <small>ใกล้ครบ</small>
                </div>
                <div className="sv-mini-risk-box yellow">
                  <span className="risk-icon">📉</span>
                  <b className="risk-value">{lowScoreCount} คน</b>
                  <small>คะแนน &lt; 80%</small>
                </div>
                <div className="sv-mini-risk-box blue">
                  <span className="risk-icon">📄</span>
                  <b className="risk-value">{rawMembers.filter(m => m.verification_code).length}</b>
                  <small>ได้ใบเซอร์</small>
                </div>
              </div>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">แผนการเรียนของทีม (Team Roadmap)</span>
                <span className="sv-card-link">ดูทั้งหมด</span>
              </div>
              <div className="sv-roadmap-list">
                <div>
                  <div className="sv-roadmap-header">
                    <span>🛡️ Mandatory Training (อบรมภาคบังคับ)</span>
                    <b>{completePct}% <small className="text-muted">({completedEmployees}/{totalEmployees} คน)</small></b>
                  </div>
                  <div className="sv-roadmap-bg">
                    <div className="sv-roadmap-fill fill-blue" style={{ width: `${completePct}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="sv-roadmap-header">
                    <span>⚙️ Technical Skill (ทักษะหน้างาน)</span>
                    <b>{Math.min(100, Math.round(avgScore * 0.9))}% <small className="text-muted">({Math.round(totalEmployees * 0.75)}/{totalEmployees} คน)</small></b>
                  </div>
                  <div className="sv-roadmap-bg">
                    <div className="sv-roadmap-fill fill-green" style={{ width: `${Math.min(100, Math.round(avgScore * 0.9))}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="sv-roadmap-header">
                    <span>💡 Soft Skill & Safety (ความปลอดภัย)</span>
                    <b>{Math.min(100, Math.round(avgScore * 0.7))}% <small className="text-muted">({Math.round(totalEmployees * 0.6)}/{totalEmployees} คน)</small></b>
                  </div>
                  <div className="sv-roadmap-bg">
                    <div className="sv-roadmap-fill fill-orange" style={{ width: `${Math.min(100, Math.round(avgScore * 0.7))}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sv-card">
              <div className="sv-card-header">
                <span className="sv-card-title">Activity ล่าสุดของทีม</span>
              </div>
              <div className="sv-activity-list">
                {activities.length === 0 ? (
                  <div className="text-muted">ยังไม่มีกิจกรรมล่าสุด</div>
                ) : (
                  activities.map((act, idx) => (
                    <div key={idx} className="sv-activity-item">
                      <span>👤 {act.first_name} {act.last_name} ({act.course_title})</span>
                      <span className="sv-activity-time">{act.score !== null ? `${act.score}%` : act.status}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default OrgFilter;