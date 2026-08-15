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
    position: "Operator Leader"
  };

  const certId = currentEmployee.verification_code || `CERT-XXXX-XXXX`;
  const certUuid = currentEmployee.cert_uuid || "default-uuid";
  
  const verifyUrl = `${window.location.origin}/verify/${certUuid}`;

  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}&color=1a237e&bgcolor=fffdf6`;

  const handleSimulateVerify = () => {
    window.open(verifyUrl, '_blank');
  };

  const handleDownloadPDF = () => {
    setIsGenerating(true);
    const element = document.getElementById("certificate-view");

    const options = {
      margin: 0,
      filename: `Certificate_${currentEmployee.employee_code}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true }, 
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
    };

    html2pdf()
      .set(options)
      .from(element)
      .save()
      .then(() => setIsGenerating(false))
      .catch((err) => {
        console.error("PDF Error:", err);
        setIsGenerating(false);
      });
  };

  return (
    <div className="cert-page-container">
      <div className="action-bar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button className="download-cert-btn" onClick={handleDownloadPDF} disabled={isGenerating}>
          {isGenerating ? "กำลังสร้าง PDF..." : "ดาวน์โหลดใบประกาศนียบัตร (PDF)"}
        </button>

        <button 
          className="download-cert-btn" 
          onClick={handleSimulateVerify}
          style={{ backgroundColor: '#2e7d32' }}
        >
          ทดสอบระบบสแกนตรวจสอบ
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
              
              <h3 className="cert-course">"ระบบควบคุมคุณภาพการผลิตขั้นสูง (Advanced QA Control)"</h3>
              <p className="cert-date">ให้ไว้ ณ วันที่ 18 กรกฎาคม 2569</p>

              <div className="cert-footer-zone">
                <div className="cert-signatures">
                  <div className="signature-block">
                    <h1>(John Esan)</h1>
                    <div className="sign-line"></div>
                    <p>(ผู้จัดการฝ่ายทรัพยากรบุคคล)</p>
                  </div>
                </div>

                <div className="cert-qrcode-block">
                  <img 
                    src={qrCodeApiUrl} 
                    alt="Verification QR Code" 
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
      
      <button style={{ marginTop: '5%' }} onClick={() => navigate("/dashboard")}>Click return</button>
    </div>
  );
}

export default Certificate;