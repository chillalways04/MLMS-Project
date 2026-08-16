import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

function Dashboard() {
  const [user] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      alert("กรุณาเข้าสู่ระบบก่อนใช้งาน!");
      navigate("/login");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  if (!user) {
    return <div className="loading">กำลังโหลดข้อมูลระบบ...</div>;
  }

  return (
    <div className="dashboard-wrapper">
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
          <div className="user-avatar-tag" onClick={handleLogout} title="คลิกเพื่อออกจากระบบ">
            <div className="mini-avatar">👤</div>
            <span>{user.first_name || "พนักงานปกติ"}</span>
          </div>
        </div>
      </header>

      <section className="stats-row">
        <div className="stat-box">
          <span className="box-icon icon-blue">📖</span>
          <div>
            <div className="stat-label">ทั้งหมด</div>
            <div className="stat-num">32 <span className="stat-unit">บทเรียน</span></div>
            <small className="stat-sub">ที่ต้องเรียนทั้งหมด</small>
          </div>
        </div>
        <div className="stat-box">
          <span className="box-icon icon-green">✅</span>
          <div>
            <div className="stat-label">เรียนจบแล้ว</div>
            <div className="stat-num">
              18 <span className="stat-unit">บทเรียน</span> <span className="tag green">56%</span>
            </div>
          </div>
        </div>
        <div className="stat-box">
          <span className="box-icon icon-orange">🕒</span>
          <div>
            <div className="stat-label">กำลังเรียน</div>
            <div className="stat-num">
              6 <span className="stat-unit">บทเรียน</span> <span className="tag orange">19%</span>
            </div>
          </div>
        </div>
        <div className="stat-box">
          <span className="box-icon icon-purple">▶️</span>
          <div>
            <div className="stat-label">ยังไม่เริ่ม</div>
            <div className="stat-num">
              6 <span className="stat-unit">บทเรียน</span> <span className="tag purple">19%</span>
            </div>
          </div>
        </div>
        <div className="stat-box">
          <span className="box-icon icon-red">❌</span>
          <div>
            <div className="stat-label">ไม่ผ่าน/ต้องซ่อม</div>
            <div className="stat-num">
              2 <span className="stat-unit">บทเรียน</span> <span className="tag red">6%</span>
            </div>
          </div>
        </div>
      </section>

     <section className="grid-3-col">
        <div className="card">
          <h4>ความก้าวหน้าการเรียนของฉัน</h4>
          <div className="circle-progress-wrapper">
            <div className="circular-chart">
              <div className="circle-inner">
                <strong>56%</strong>
                <span>ความคืบหน้า</span>
              </div>
            </div>
            <div className="progress-legend">
              <p>
                <span><span className="dot dot-green"></span> ความปลอดภัย (Safety)</span>
                <b>100%</b>
                <span className="text-success">ผ่าน</span>
              </p>
              <p>
                <span><span className="dot dot-yellow"></span> คุณภาพ (Quality)</span>
                <b>75%</b>
                <span className="text-warning">กำลังเรียน</span>
              </p>
              <p>
                <span><span className="dot dot-orange"></span> การปฏิบัติงานเครื่องจักร</span>
                <b>40%</b>
                <span className="text-warning">กำลังเรียน</span>
              </p>
              <p>
                <span><span className="dot dot-gray"></span> การบำรุงรักษาเบื้องต้น (PM)</span>
                <b>0%</b>
                <span className="text-muted">ยังไม่เริ่ม</span>
              </p>
            </div>
          </div>
          <button className="btn-outline w-100 mt-auto" >
            ดูรายละเอียดทั้งหมด
          </button>
        </div>

        <div className="card">
          <h4>แผนการเรียนของฉัน (ตามตำแหน่งงาน)</h4>
          <div className="plan-list">
            <div className="plan-item">
              <span>📘 Mandatory Training</span>
              <div className="progress-bar-bg">
                <div className="progress-fill green" style={{ width: "90%" }}></div>
              </div>
              <small>90% (9/10 บทเรียน)</small>
            </div>
            <div className="plan-item">
              <span>🛠️ Technical Skill</span>
              <div className="progress-bar-bg">
                <div className="progress-fill teal" style={{ width: "78%" }}></div>
              </div>
              <small>78% (7/9 บทเรียน)</small>
            </div>
            <div className="plan-item">
              <span>💡 Soft Skill</span>
              <div className="progress-bar-bg">
                <div className="progress-fill orange" style={{ width: "60%" }}></div>
              </div>
              <small>60% (6/10 บทเรียน)</small>
            </div>
            <div className="plan-item">
              <span>⚙️ Work Instruction</span>
              <div className="progress-bar-bg">
                <div className="progress-fill yellow" style={{ width: "45%" }}></div>
              </div>
              <small>45% (5/11 บทเรียน)</small>
            </div>
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
          <h4>หลักสูตรที่ต้องเรียนต่อ <span className="counter-pill">6</span></h4>
          <div className="course-action-item">
            <div>
              <div className="course-title">การตั้งค่าเครื่องจักรเบื้องต้น</div>
              <small>Machine Setup Basics</small>
            </div>
            <div className="course-action-right">
              <span>60%</span>
              <button className="btn-primary-sm">ดูบทเรียน</button>
            </div>
          </div>
          <div className="course-action-item">
            <div>
              <div className="course-title">การควบคุมคุณภาพในกระบวนการ</div>
              <small>In-process Quality Control</small>
            </div>
            <div className="course-action-right">
              <span>40%</span>
              <button className="btn-primary-sm">ดูบทเรียน</button>
            </div>
          </div>
          <div className="course-action-item">
            <div>
              <div className="course-title">การตรวจสอบ 5 ส</div>
              <small>5S Inspection</small>
            </div>
            <div className="course-action-right">
              <span className="text-success font-bold">80%</span>
              <button className="btn-success-sm" onClick={() => setShowModal(true)}>
                ผ่านการทดสอบ
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <h4>หลักสูตรที่ไม่ผ่าน / ต้องซ่อม <span className="counter-pill red">2</span></h4>
          <div className="course-action-item border-red">
            <div>
              <div className="course-title">ความปลอดภัยในการทำงาน</div>
              <small>Safety at Work</small>
            </div>
            <div className="course-action-right">
              <span className="text-danger">คะแนน 65%</span>
              <button className="btn-outline-danger-sm">ซ่อม</button>
            </div>
          </div>
          <div className="course-action-item border-red">
            <div>
              <div className="course-title">ความรู้พื้นฐานคุณภาพ</div>
              <small>Quality Basic</small>
            </div>
            <div className="course-action-right">
              <span className="text-danger">คะแนน 70%</span>
              <button className="btn-outline-danger-sm">ซ่อม</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header-flex">
            <h4>ผลการประเมินล่าสุด</h4>
            <a href="#all" className="link-text">ดูทั้งหมด</a>
          </div>
          <div className="assessment-item">
            <div className="assessment-left">
              <span className="status-badge-circle green">✅</span>
              <div className="assessment-detail">
                <div className="course-title">การตรวจสอบ 5 ส</div>
                <small className="eval-date-sub">วันที่สอบ: 10/05/2024</small>
              </div>
            </div>
            <div className="score-val text-success">85%</div>
          </div>
          <div className="assessment-item">
            <div className="assessment-left">
              <span className="status-badge-circle red">❌</span>
              <div className="assessment-detail">
                <div className="course-title">ความปลอดภัยในการทำงาน</div>
                <small className="eval-date-sub">วันที่สอบ: 10/05/2024</small>
              </div>
            </div>
            <div className="score-val text-danger">ไม่ผ่าน</div>
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
          <div className="history-row">
            <span>✅ GMP Refresher Training</span>
            <span className="status-tag green">เรียนจบ</span>
            <b>85%</b>
          </div>
          <div className="history-row">
            <span>✅ QC Basic</span>
            <span className="status-tag green">เรียนจบ</span>
            <b>80%</b>
          </div>
          <div className="history-row">
            <span>🔄 Machine Setup</span>
            <span className="status-tag yellow">กำลังเรียน</span>
            <b>60%</b>
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
        💡 <b>Tips:</b> เรียนให้ครบตามแผน และผ่านเกณฑ์ 80% ขึ้นไปในการประเมิน เพื่อพัฒนาความรู้และความปลอดภัยในการทำงาน 👍
      </footer>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            
            <div className="success-checkmark">
              <svg className="checkmark-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                <circle className="checkmark-circle" cx="26" cy="26" r="23" fill="none" />
                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>

            <h3>ผ่านการทดสอบ</h3>
            <p>
              คุณผ่านการทดสอบหลักสูตร <b>การตรวจสอบ 5 ส (5S Inspection)</b> เรียบร้อยแล้ว ด้วยคะแนน <b>80%</b>
            </p>

            <div className="modal-action-btns">
              <button 
                className="btn-view-pdf" 
                onClick={() => { navigate("/certificate");   
                  alert("กำลังเปิดไฟล์ PDF ใบรับรอง...");
                }}
              >
                View PDF
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