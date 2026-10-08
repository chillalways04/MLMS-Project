import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

// ใช้ Relative Path เพื่อให้วิ่งผ่าน Vite Proxy และ Cloudflare Tunnel ได้ทั้งบนคอมและมือถือ
const API_BASE = "";

function Dashboard() {
  const [user] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  // ตรวจเกณฑ์การผ่าน (คะแนน >= 80%)
 const isCoursePassed = (item) => {
  if (!item) return false;

  const score = Number(
    item.score ?? item.exam_score ?? 0
  );

  return Number.isFinite(score) && score >= 80;
};

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!user?.id || !token) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
      return;
    }


    const controller = new AbortController();

    const fetchDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_BASE}/api/user-dashboard/${user.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          navigate("/login", { replace: true });
          return;
        }

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "โหลดข้อมูลไม่สำเร็จ");
        }

        if (!Array.isArray(result.data)) {
          throw new Error("รูปแบบข้อมูลจากเซิร์ฟเวอร์ไม่ถูกต้อง");
        }

        if (!controller.signal.aborted) {
          setCourses(result.data);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Fetch dashboard error:", err);
          setError(err.message || "ไม่สามารถโหลดข้อมูลได้");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      controller.abort();
    };
  }, [user, navigate]);

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    }
  };

  const handleOpenModal = (course) => {
    const score = Number(course.score ?? course.exam_score ?? 0);
    if (!isCoursePassed(course)) {
      alert(`ไม่สามารถดูใบประกาศนียบัตรได้ เนื่องจากคะแนนสอบของคุณ (${score}%) ไม่ถึงเกณฑ์ขั้นต่ำ 80% หรือยังไม่ผ่านการประเมิน`);
      return;
    }
    setSelectedCourse(course);
    setShowModal(true);
  };

  const handleViewPDF = () => {
    if (!selectedCourse || !isCoursePassed(selectedCourse)) {
      alert("ไม่สามารถเปิดดูใบประกาศนียบัตรได้");
      return;
    }

    const updatedUser = {
      ...user,
      cert_uuid: selectedCourse.cert_uuid,
      verification_code: selectedCourse.verification_code,
      course_title: selectedCourse.course_title,
      issued_at: selectedCourse.issued_at
    };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    navigate(`/certificate/${selectedCourse.cert_uuid}`);
  };

  // รวมหลักสูตรไม่ให้ซ้ำกัน
  const uniqueCourses = useMemo(() => {
    return Array.from(
      new Map((courses || []).map(item => [item.course_id || item.course_title, item])).values()
    );
  }, [courses]);

  // คำนวณสรุปผลผ่าน/ตก
  const { passedList, failedList, overallProgress } = useMemo(() => {
    const passed = uniqueCourses.filter(isCoursePassed);
    const failed = uniqueCourses.filter((c) => !isCoursePassed(c));
    const total = uniqueCourses.length;
    const progress = total > 0 ? Math.round((passed.length / total) * 100) : 0;

    return {
      passedList: passed,
      failedList: failed,
      overallProgress: progress,
    };
  }, [uniqueCourses]);

  // คำนวณแผนการเรียนตามหมวดหมู่
  const categoryPlans = useMemo(() => {
    const categoryConfigs = [
      { 
        title: 'Mandatory Training', 
        keywords: ['gmp', 'safety', 'ความปลอดภัย', 'กฎระเบียบ', 'สิ่งแวดล้อม'],
        defaultTotal: 2
      },
      { 
        title: 'Technical Skill', 
        keywords: ['machine', 'setup', 'เครื่องจักร', 'pm', 'ซ่อมบำรุง', 'เทคนิค'],
        defaultTotal: 2
      },
      { 
        title: 'Soft Skill', 
        keywords: ['kaizen', '5s', 'สื่อสาร', 'หัวหน้างาน', 'จิตวิทยา'],
        defaultTotal: 1
      },
      { 
        title: 'Work Instruction', 
        keywords: ['wi', 'sop', 'ประกอบ', 'บรรจุ', 'ขั้นตอน'],
        defaultTotal: 2
      }
    ];

    return categoryConfigs.map((cfg) => {
      const matchedCourses = uniqueCourses.filter((c) => {
        const title = (c.course_title || '').toLowerCase();
        return cfg.keywords.some((kw) => title.includes(kw));
      });

      const passedCount = matchedCourses.filter(isCoursePassed).length;
      const totalCount = matchedCourses.length > 0 ? matchedCourses.length : cfg.defaultTotal;
      const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

      return {
        title: cfg.title,
        passed: passedCount,
        total: totalCount,
        percent: percent
      };
    });
  }, [uniqueCourses]);

  if (!user || loading) {
    return <div className="loading">กำลังโหลดข้อมูลระบบ...</div>;
  }

  return (
    <div className="dashboard-wrapper">
      {error && (
        <p role="alert" style={{ color: "red" }}>
          {error}
        </p>
      )}
      <header className="dash-header">
        <div>
          <span className="welcome-text">Welcome back,</span>
          <h2 className="user-name-highlight">
            {user.first_name || "นายพนักงานปกติ"} {user.last_name || ""}
          </h2>
          <p className="user-subtitle">
            Operator A - Team {user.team_id || "A"} / Line 1 / {user.position || "Filling"}
          </p>
        </div>
        <div className="header-actions">
          <div className="notification-icon">
            🔔<span className="badge-count">3</span>
          </div>
          <div className="help-icon">❓</div>
          <div className="user-avatar-tag">
            <span className="mini-avatar">👤</span>
            <span>{user?.first_name || "สมชาย"}</span>
          </div>
          <button className="btn-logout-icon" title="ออกจากระบบ" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </header>

      <section className="stats-row">
        <div className="stat-box">
          <span className="box-icon icon-blue">📖</span>
          <div>
            <div className="stat-label">ทั้งหมด</div>
            <div className="stat-num">
              {uniqueCourses.length} <span className="stat-unit">บทเรียน</span>
            </div>
            <small className="stat-sub">ที่ต้องเรียนทั้งหมด</small>
          </div>
        </div>

        <div className="stat-box">
          <span className="box-icon icon-green">✅</span>
          <div>
            <div className="stat-label">เรียนจบแล้ว (≥ 80%)</div>
            <div className="stat-num">
              {passedList.length} <span className="stat-unit">บทเรียน</span>{" "}
              <span className="tag green">
                {uniqueCourses.length > 0
                  ? Math.round((passedList.length / uniqueCourses.length) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        <div className="stat-box">
          <span className="box-icon icon-orange">🕒</span>
          <div>
            <div className="stat-label">กำลังเรียน</div>
            <div className="stat-num">
              0 <span className="stat-unit">บทเรียน</span>{" "}
              <span className="tag orange">0%</span>
            </div>
          </div>
        </div>

        <div className="stat-box">
          <span className="box-icon icon-purple">▶️</span>
          <div>
            <div className="stat-label">ยังไม่เริ่ม</div>
            <div className="stat-num">
              0 <span className="stat-unit">บทเรียน</span>{" "}
              <span className="tag purple">0%</span>
            </div>
          </div>
        </div>

        <div className="stat-box">
          <span className="box-icon icon-red">❌</span>
          <div>
            <div className="stat-label">ไม่ผ่าน (&lt; 80%)</div>
            <div className="stat-num">
              {failedList.length} <span className="stat-unit">บทเรียน</span>{" "}
              <span className="tag red">
                {uniqueCourses.length > 0
                  ? Math.round((failedList.length / uniqueCourses.length) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3-col">
        <div className="card">
          <h4>ความก้าวหน้าการเรียนของฉัน</h4>
          <div className="circle-progress-wrapper">
            <div 
              className="circular-chart" 
              style={{ background: `conic-gradient(var(--success) 0% ${overallProgress}%, #e2e8f0 ${overallProgress}% 100%)` }}
            >
              <div className="circle-inner">
                <strong>{overallProgress}%</strong>
                <span>ความคืบหน้า</span>
              </div>
            </div>

            <div className="progress-legend">
              {uniqueCourses.slice(0, 4).map((c, idx) => {
                const score = Number(c.score || 0);
                const isPass = isCoursePassed(c);
                return (
                  <p key={c.exam_id || c.course_id || idx}>
                    <span>
                      <i className={`dot ${isPass ? 'dot-green' : score > 0 ? 'dot-yellow' : 'dot-gray'}`}></i>
                      {c.course_title}
                    </span>
                    <b>{score}%</b>
                    <span className={isPass ? 'text-success' : score > 0 ? 'text-warning' : 'text-muted'}>
                      {isPass ? 'ผ่าน' : score > 0 ? 'กำลังเรียน' : 'ยังไม่เริ่ม'}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
          <button className="btn-outline w-100 mt-auto">ดูรายละเอียดทั้งหมด</button>
        </div>

        <div className="card">
          <h4>แผนการเรียนของฉัน (ตามตำแหน่งงาน)</h4>
          <div className="plan-list">
            {categoryPlans.length > 0 ? (
              categoryPlans.slice(0, 4).map((plan, idx) => (
                <div className="plan-item" key={idx}>
                  <span title={plan.title}>{plan.title}</span>
                  <div className="progress-bar-bg">
                    <div 
                      className={`progress-fill ${plan.percent >= 80 ? 'green' : plan.percent >= 50 ? 'teal' : 'orange'}`} 
                      style={{ width: `${plan.percent}%` }}
                    ></div>
                  </div>
                  <small>{plan.percent}% ({plan.passed}/{plan.total} บทเรียน)</small>
                </div>
              ))
            ) : (
              <div className="text-muted" style={{ margin: 'auto', padding: '20px 0' }}>ไม่มีรายการแผนการเรียน</div>
            )}
          </div>
          <button className="btn-outline w-100 mt-auto">ดูแผนการเรียนทั้งหมด</button>
        </div>

        <div className="card">
          <div className="card-header-flex">
            <h4>บทเรียนที่ต้องเรียน / กำหนดเวลา</h4>
            <a href="#all" className="link-text">ดูทั้งหมด</a>
          </div>
          <ul className="due-list">
            <li>
              <span>📖 GMP Refresher Training</span>
              <small className="text-danger">ครบกำหนด 10 พ.ค. 67</small>
            </li>
            <li>
              <span>📖 QC Basic</span>
              <small className="text-danger">ครบกำหนด 15 พ.ค. 67</small>
            </li>
            <li>
              <span>📖 Machine Setup</span>
              <small className="text-danger">ครบกำหนด 20 พ.ค. 67</small>
            </li>
            <li>
              <span>📖 5 ส ในการปฏิบัติงาน</span>
              <small className="text-danger">ครบกำหนด 25 พ.ค. 67</small>
            </li>
          </ul>
          <button className="btn-outline w-100 mt-auto">ดูแผนการเรียนทั้งหมด</button>
        </div>
      </section>

      <section className="grid-3-col">
        <div className="card">
          <h4>หลักสูตรที่ต้องเรียนต่อ <span className="counter-pill">{uniqueCourses.length}</span></h4>
          
          <div className="course-scroll-container">
            {uniqueCourses.map((item) => {
              const score = Number(item.score || 0);
              const isPass = isCoursePassed(item);

              return (
                <div className="course-action-item" key={item.exam_id || item.course_id}>
                  <div>
                    <div className="course-title">{item.course_title}</div>
                    <small>{isPass ? "ผ่านเกณฑ์ 80% แล้ว" : "คะแนนไม่ถึงเกณฑ์ (ต้องซ่อม)"}</small>
                  </div>
                  <div className="course-action-right">
                    <span className={isPass ? "text-success font-bold" : "text-warning"}>{score}%</span>
                    {isPass ? (
                      <button className="btn-success-sm" onClick={() => handleOpenModal(item)}>
                         ผ่านการทดสอบ
                      </button>
                    ) : (
                      <button className="btn-primary-sm">ดูบทเรียน</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h4>หลักสูตรที่ไม่ผ่าน / ต้องซ่อม (&lt; 80%) <span className="counter-pill red">{failedList.length}</span></h4>
          {failedList.length === 0 ? (
            <p style={{ color: "#166534", fontSize: "14px", padding: "10px 0" }}>ไม่มีวิชาที่ต้องซ่อม 🎉</p>
          ) : (
            failedList.map((item) => (
              <div className="course-action-item border-red" key={item.exam_id || item.course_id}>
                <div>
                  <div className="course-title">{item.course_title}</div>
                  <small>วันที่สอบ: {item.tested_at || "-"}</small>
                </div>
                <div className="course-action-right">
                  <span className="text-danger">คะแนน {item.score}%</span>
                  <button className="btn-outline-danger-sm">ซ่อม</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="card-header-flex">
            <h4>ผลการประเมินล่าสุด</h4>
            <a href="#all" className="link-text">ดูทั้งหมด</a>
          </div>

          <div className="assessment-scroll-container">
            {uniqueCourses.map((item) => {
              const score = Number(item.score || 0);
              const isPass = isCoursePassed(item);

              return (
                <div className="assessment-item" key={item.exam_id || item.course_id}>
                  <div className="assessment-left">
                    <span className={`status-badge-circle ${isPass ? "green" : "red"}`}>
                      {isPass ? "✅" : "❌"}
                    </span>
                    <div className="assessment-detail">
                      <div className="course-title">{item.course_title}</div>
                      <small className="eval-date-sub">วันที่สอบ: {item.tested_at || "-"}</small>
                    </div>
                  </div>
                  <div className={`score-val ${isPass ? "text-success" : "text-danger"}`}>
                    {isPass ? `${score}%` : "ไม่ผ่าน"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid-3-col">
        <div className="card">
          <div className="card-header-flex">
            <h4>ประกาศจากบริษัท</h4>
            <a href="#all" className="link-text">ดูทั้งหมด</a>
          </div>
          <div className="announcement-item">
            <span>📢 แจ้งเปลี่ยนแปลงเวลาอบรม Safety Training</span>
            <small>08 พ.ค. 67</small>
          </div>
          <div className="announcement-item">
            <span>📢 ขอเชิญเข้าร่วมกิจกรรม 5s Big Cleaning Day</span>
            <small>05 พ.ค. 67</small>
          </div>
          <div className="announcement-item">
            <span>📢 อัปเดตเอกสาร Work Instruction Line 1</span>
            <small>02 พ.ค. 67</small>
          </div>
        </div>

        <div className="card">
          <div className="card-header-flex">
            <h4>ประวัติการเรียนล่าสุด</h4>
            <a href="#all" className="link-text">ดูทั้งหมด</a>
          </div>

          <div className="history-scroll-container">
            {uniqueCourses.map((item, idx) => {
              const score = Number(item.score || 0);
              const isComplete = isCoursePassed(item);
              return (
                <div className="history-row" key={item.exam_id || item.course_id || idx}>
                  <span>
                    {isComplete ? '✅' : '🔄'} {item.course_title}
                  </span>
                  <span className={`status-tag ${isComplete ? 'green' : 'yellow'}`}>
                    {isComplete ? 'ผ่านเกณฑ์' : 'กำลังเรียน'}
                  </span>
                  <b>{score}%</b>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h4>ติดต่อ / บุคคลที่เกี่ยวข้อง</h4>
          <div className="contact-list">
            <div className="contact-row">
              <div className="contact-left">
                <span className="contact-avatar">👨‍💼</span>
                <div className="contact-info">
                  <span className="contact-role">หัวหน้างาน</span>
                  <span className="contact-name">คุณสมชาย ใจดี</span>
                </div>
              </div>
              <div className="contact-right">
                <span className="contact-tel">02-123-4567</span>
                <span className="contact-chat-icon">💬</span>
              </div>
            </div>

            <div className="contact-row">
              <div className="contact-left">
                <span className="contact-avatar">👩‍💼</span>
                <div className="contact-info">
                  <span className="contact-role">ผู้ประสานงานการอบรม</span>
                  <span className="contact-name">คุณวิภา รักการอบรม</span>
                </div>
              </div>
              <div className="contact-right">
                <span className="contact-tel">02-234-5678</span>
                <span className="contact-chat-icon">💬</span>
              </div>
            </div>

            <div className="contact-row">
              <div className="contact-left">
                <span className="contact-avatar">👩‍💼</span>
                <div className="contact-info">
                  <span className="contact-role">ฝ่าย HR</span>
                  <span className="contact-name">คุณมณีวรรณ สุขใจ</span>
                </div>
              </div>
              <div className="contact-right">
                <span className="contact-tel">02-345-6789</span>
                <span className="contact-chat-icon">💬</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="dash-footer-tip">
        💡 <b>Tips:</b> เรียนให้ครบตามแผน และผ่านเกณฑ์ 80% ขึ้นไปในการประเมิน เพื่อรับใบประกาศนียบัตร (Certificate) 👍
      </footer>

      {showModal && selectedCourse && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="success-checkmark">
              <svg className="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark-circle" cx="26" cy="26" r="23" fill="none" />
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <h3>ผ่านการทดสอบ (≥ 80%)</h3>
            <p>
              คุณผ่านการทดสอบหลักสูตร <b>{selectedCourse.course_title}</b> เรียบร้อยแล้ว ด้วยคะแนน <b>{selectedCourse.score}%</b>
            </p>

            <div className="modal-action-btns">
              <button className="btn-view-pdf" onClick={handleViewPDF}>
                View PDF (ใบประกาศ)
              </button>
              <button className="btn-close-modal" onClick={() => setShowModal(false)}>
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;