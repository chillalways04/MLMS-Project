import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import html2pdf from "html2pdf.js"; 
import "./Certificate.css";

function Certificate() {
  const navigate = useNavigate();

  const [employee] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  useEffect(() => {
    if (!employee) {
      alert("กรุณาเข้าสู่ระบบก่อนใช้งาน!");
      navigate("/login");
    }
  }, [employee, navigate]);

  const [isGenerating, setIsGenerating] = useState(false);

  const currentEmployee = employee || {
    first_name: "สมชาย",
    last_name: "สายผลิต",
    employee_code: "OP-69001",
    position: "Operator Leader",
    course_title: "หลักสูตรมาตรฐานโรงงาน",
    issued_at: "2026-08-23"
  };

  const certId = currentEmployee.verification_code || "CERT-2026-0001";
  const certUuid = currentEmployee.cert_uuid || "a1b2c3d4-e5f6-7a8b";

  // URL สำหรับมือถือสแกนผ่าน QR Code (อัปเดต Subdomain Cloudflare Tunnel ที่นี่ //คำสั่ง npx cloudflared tunnel --url http://localhost:5173)
  const mobileVerifyUrl = ` https://edward-original-mai-prints.trycloudflare.com/verify/${certUuid}`;
  const localTestUrl = `${window.location.origin}/verify/${certUuid}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileVerifyUrl)}&color=1a237e&bgcolor=fffdf6`;

  const handleSimulateVerify = () => {
    window.open(localTestUrl, '_blank');
  };

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    const element = document.getElementById("certificate-view");

    const options = {
      margin: 0,
      filename: `Certificate_${currentEmployee.employee_code}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false }, 
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    };

    html2pdf()
      .set(options)
      .from(element)
      .save()
      .then(() => setIsGenerating(false))
      .catch((err) => {
        console.error("PDF Export Error:", err);
        setIsGenerating(false);
      });
  };

  return (
    <div className="cert-page-container">
      <div className="action-bar" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button className="download-cert-btn" onClick={handleDownloadPDF} disabled={isGenerating}>
          {isGenerating ? "กำลังสร้าง PDF..." : "ดาวน์โหลดใบประกาศนียบัตร (PDF)"}
        </button>

        <button 
          className="download-cert-btn" 
          onClick={handleSimulateVerify}
          style={{ backgroundColor: '#2e7d32' }}
        >
          ทดสอบระบบสแกน (เปิดในคอม)
        </button>

        <button 
          className="download-cert-btn" 
          onClick={() => navigate("/dashboard")}
          style={{ backgroundColor: '#475569' }}
        >
          กลับสู่ Dashboard
        </button>
      </div>

      <div className="cert-wrapper">
        <div id="certificate-view" className="certificate-body">
          <div className="cert-border">
            <div className="cert-inner-border">
              
              <h1 className="cert-title">Certificate</h1>
              <p className="cert-subtitle">ใบรับรองฉบับนี้ให้ไว้เพื่อแสดงว่า</p>

              <h2 className="cert-name">คุณ{currentEmployee.first_name} {currentEmployee.last_name}</h2>
              <p className="cert-details">
                รหัสพนักงาน: <strong>{currentEmployee.employee_code}</strong> | ตำแหน่ง: <strong>{currentEmployee.position}</strong>
              </p>

              <div className="cert-divider"></div>
              <p className="cert-subtitle">ได้ผ่านการอบรมและทดสอบหลักสูตร</p>             
              <h3 className="cert-course">"{currentEmployee.course_title}"</h3>             
              <p className="cert-date">
                ให้ไว้ ณ วันที่ {currentEmployee.issued_at || '18 กรกฎาคม 2569'}
              </p>

              <div className="cert-footer-zone">
                <div className="cert-signatures">
                  <div className="signature-block">
                    <h3 style={{ margin: 0, fontFamily: 'serif' }}>(John Esan)</h3>
                    <div className="sign-line"></div>
                    <p>(ผู้จัดการฝ่ายทรัพยากรบุคคล)</p>
                  </div>
                </div>

                <div className="cert-qrcode-block">
                  <img 
                    src={qrCodeApiUrl} 
                    alt="Verification QR Code" 
                    crossOrigin="anonymous"
                    style={{ width: "85px", height: "85px", display: "block" }} 
                  />
                  <p className="qrcode-text">สแกนเพื่อตรวจสอบความถูกต้อง</p>
                  <p className="cert-id-text">ID: {certId}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Certificate;