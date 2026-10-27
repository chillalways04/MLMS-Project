import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom"; 
import html2pdf from "html2pdf.js"; 
import "./Certificate.css";

const API_BASE = "";

function Certificate() {
  const navigate = useNavigate();
  const { uuid } = useParams();

  const initialToken = localStorage.getItem("token");
  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(Boolean(initialToken && uuid));
  const [error, setError] = useState(!uuid ? "ไม่พบรหัสใบประกาศนียบัตร" : "");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      alert("กรุณาเข้าสู่ระบบก่อนใช้งาน!");
      navigate("/login", { replace: true });
      return;
    }

    if (!uuid) return;

    const controller = new AbortController();

    const fetchCertificateData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/certificates/${uuid}`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
          signal: controller.signal,
        });

        if (res.status === 401) {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
          navigate("/login", { replace: true });
          return;
        }

        const result = await res.json();

        if (!res.ok || !result.success) {
          throw new Error(result.message || "ไม่สามารถดึงข้อมูลใบประกาศได้");
        }

        if (!controller.signal.aborted) {
          setCertData(result.data);
          setError("");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Fetch Certificate Error:", err);
          setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchCertificateData();

    return () => {
      controller.abort();
    };
  }, [uuid, navigate]);

const handleDownloadPDF = async () => {
  if (isGenerating) return;

  const element = document.getElementById("certificate-view");

  if (!element) {
    alert("ไม่พบใบประกาศนียบัตรสำหรับดาวน์โหลด");
    return;
  }

  setIsGenerating(true);

  try {
    // รอฟอนต์บนหน้าเว็บโหลดเสร็จ
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // ใช้สำเนาสำหรับ Export เท่านั้น
    // ไม่เปลี่ยนขนาดหรือสไตล์ของใบประกาศที่ผู้ใช้กำลังดู
    const exportElement = element.cloneNode(true);
    exportElement.removeAttribute("id");

    const applyStyles = (target, styles) => {
      if (!target) return;

      Object.entries(styles).forEach(([property, value]) => {
        target.style.setProperty(property, value, "important");
      });
    };

    // กำหนดขนาดเนื้อหาให้ตรงกับ Canvas
    applyStyles(exportElement, {
      width: "1122px",
      height: "793px",

      "min-width": "1122px",
      "min-height": "793px",
      "max-width": "1122px",
      "max-height": "793px",

      margin: "0",
      padding: "30px 40px",

      "box-sizing": "border-box",
      transform: "none",
      "aspect-ratio": "auto",
      flex: "none",

      display: "flex",
      "flex-direction": "column",
      "background-color": "#fffdf6",
    });

    // ให้กรอบทองยืดเต็มพื้นที่ภายในใบประกาศ
    exportElement
      .querySelectorAll(".cert-border, .cert-inner-border")
      .forEach((border) => {
        applyStyles(border, {
          width: "100%",
          height: "auto",

          "min-width": "0",
          "min-height": "0",
          "max-height": "none",

          "box-sizing": "border-box",
          display: "flex",
          "flex-direction": "column",
          flex: "1 1 0",
        });
      });

    // รอรูปภาพและ QR Code ของสำเนาโหลดครบ
    await Promise.all(
      Array.from(exportElement.querySelectorAll("img")).map(
        async (img) => {
          await img.decode();

          if (!img.naturalWidth) {
            throw new Error(
              "โหลดรูปภาพหรือ QR Code ไม่สำเร็จ กรุณาลองใหม่"
            );
          }
        }
      )
    );

    const options = {
      margin: 0,

      filename: `Certificate_${
        certData?.employee_code || "export"
      }.pdf`,

      // PNG ช่วยเก็บรายละเอียดตัวอักษรและ QR Code
      image: {
        type: "png",
      },

      // ใบประกาศเป็นเอกสารหน้าเดียวขนาดคงที่
      pagebreak: {
        mode: [],
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#fffdf6",

        width: 1122,
        height: 793,

        // ใช้ viewport สำหรับ Export ที่พ้น breakpoint 1180px
        windowWidth: 1280,
        windowHeight: 900,

        scrollX: 0,
        scrollY: 0,
      },

      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "landscape",
      },
    };

    await html2pdf()
      .set(options)
      .from(exportElement)
      .save();
  } catch (err) {
    console.error("PDF Export Error:", err);

    alert(
      "สร้าง PDF ไม่สำเร็จ กรุณารอให้ QR Code โหลดครบแล้วลองใหม่"
    );
  } finally {
    setIsGenerating(false);
  }
};
  if (loading) {
    return (
      <div className="cert-page-container">
        <p style={{ marginTop: "40px", color: "#64748b" }}>กำลังโหลดข้อมูลใบประกาศนียบัตร...</p>
      </div>
    );
  }

  if (error || !certData) {
    return (
      <div className="cert-page-container">
        <p style={{ marginTop: "40px", color: "#ef4444" }}>{error || "ไม่พบข้อมูลใบประกาศ"}</p>
        <button 
          type="button" 
          className="download-cert-btn" 
          style={{ backgroundColor: '#475569', maxWidth: '200px', marginTop: '16px' }}
          onClick={() => navigate("/dashboard")}
        >
          กลับสู่ Dashboard
        </button>
      </div>
    );
  }

  const certId = certData.verification_code || "CERT-2026-0001";
  const certUuid = certData.uuid;

  // URL สำหรับมือถือสแกนผ่าน QR Code อัปเดต Subdomain Cloudflare Tunnel ที่นี่ //คำสั่ง npx cloudflared tunnel --url http://localhost:5173
  const mobileVerifyUrl = `https://matt-speaking-marking-neighbor.trycloudflare.com/verify/${certUuid}`;
  const localTestUrl = `${window.location.origin}/verify/${certUuid}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mobileVerifyUrl)}&color=1a237e&bgcolor=fffdf6`;

  const handleSimulateVerify = () => {
    window.open(localTestUrl, '_blank');
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

              <h2 className="cert-name">คุณ{certData.first_name} {certData.last_name}</h2>
              <p className="cert-details">
                รหัสพนักงาน: <strong>{certData.employee_code}</strong> | ตำแหน่ง: <strong>{certData.position}</strong>
              </p>

              <div className="cert-divider"></div>
              <p className="cert-subtitle">ได้ผ่านการอบรมและทดสอบหลักสูตร</p>             
              <h3 className="cert-course">"{certData.course_title}"</h3>             
              <p className="cert-date">
                ให้ไว้ ณ วันที่ {certData.issued_at || '18 กรกฎาคม 2569'}
              </p>
                <p 
                    className="cert-uuid-text" 
                    style={{ 
                      fontSize: "12px", 
                      color: "#64748b", 
                      margin: "2px 0 0 0", 
                      fontFamily: "monospace",
                      letterSpacing: "0.5px",
                      fontWeight:"600"
                    }}
                  >
                    UUID: {certUuid}
                  </p>

              <div className="cert-footer-zone">
                <div className="cert-signatures">
                  <div className="signature-block">
                    <h3 style={{ margin: 0, fontFamily: 'serif' }}>(John Odinson)</h3>
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