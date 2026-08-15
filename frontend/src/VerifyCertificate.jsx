import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./VerifyCertificate.css";


function VerifyCertificate() {
  const { uuid } = useParams(); 
  const navigate = useNavigate();
  
  const [certInfo, setCertInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:5000/api/verify-cert/${uuid}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("ไม่พบข้อมูลใบประกาศนียบัตรนี้ในระบบ (อาจเป็นไฟล์จำลองหรือถูกแก้ไข)");
        }
        return res.json();
      })
      .then((result) => {
        if (result.success && result.data) {
          setCertInfo(result.data);
          setLoading(false);
        } else {
          throw new Error(result.message || "ข้อมูลใบประกาศนียบัตรไม่ถูกต้อง");
        }
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [uuid]);

  if (loading) {
    return (
      <div className="verify-container">
        <div className="verify-card text-center">กำลังตรวจสอบข้อมูลกับฐานข้อมูล...</div>
      </div>
    );
  }

  if (error || !certInfo) { 
    return (
      <div className="verify-container invalid-bg">
        <div className="verify-card">
          <h1 className="verify-title error-title">การตรวจสอบล้มเหลว</h1>
          <p className="verify-status-text">ไม่สามารถยืนยันความถูกต้องของเอกสารฉบับนี้ได้</p>
          <div className="error-details-box">{error || "ไม่พบข้อมูลในระบบ"}</div>
          <button className="back-home-btn error-btn" onClick={() => navigate("/")}>กลับหน้าหลัก</button>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-container">
      <div className="verify-card">
        <h1 className="verify-title">ตรวจสอบสถานะสำเร็จ</h1>
        <p className="verify-status-text">ใบประกาศนียบัตรนี้เป็นเอกสารของแท้ในระบบ </p> 
        
        <div className="verify-info-table">
          <div className="info-row">
            <span className="info-label">ชื่อผู้ได้รับอนุมัติ:</span>
            <span className="info-value">คุณ {certInfo.first_name} {certInfo.last_name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">รหัสพนักงาน:</span>
            <span className="info-value">{certInfo.employee_code}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ตำแหน่ง:</span>
            <span className="info-value">{certInfo.position}</span>
          </div>
          <div className="info-row">
            <span className="info-label">หลักสูตรที่ผ่านการอบรม:</span>
            <span className="info-value">"ระบบควบคุมคุณภาพการผลิตขั้นสูง (Advanced QA Control)"</span>
          </div>
          <div className="info-row">
            <span className="info-label">เลขที่ใบรับรอง (ID):</span>
            <span className="info-value code-font">{certInfo.verification_code}</span>
          </div>
          <div className="info-row">
            <span className="info-label">วันที่ออกเอกสารในระบบ:</span>
            <span className="info-value">{certInfo.issued_at}</span>
          </div>
        </div>

        <div className="verify-details-box">
          <p className="uuid-title">รหัสความปลอดภัยของระบบ (UUID):</p>
          <code className="uuid-display">{uuid}</code>
        </div>

        <button className="back-home-btn" onClick={() => navigate("/dashboard")}>
          กลับสู่หน้าหลักระบบ
        </button>
      </div>
    </div>
  );
}

export default VerifyCertificate;