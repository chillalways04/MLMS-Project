import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Register.css";

function Register() {
  const navigate = useNavigate();

  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState("");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    employee_code: "",
    position: "Operator A",
    line_id: "",
    team_id: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. โหลดข้อมูลสายการผลิต (Lines)
  useEffect(() => {
    fetch("/api/lines")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLines(data);
          setFormData((prev) => ({ ...prev, line_id: data[0].id }));
        }
      })
      .catch((err) => {
        console.error("Fetch Lines Error:", err);
        setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อดึงข้อมูลสายการผลิตได้");
      });
  }, []);

  // 2. โหลดข้อมูลแผนก (Sections) ตาม Line ที่เลือก
  useEffect(() => {
    if (!formData.line_id) return;

    fetch(`/api/sections?line_id=${formData.line_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSections(data);
          setSelectedSectionId(data[0].id);
        } else {
          setSections([]);
          setSelectedSectionId("");
          setTeams([]);
          setFormData((prev) => ({ ...prev, team_id: "" }));
        }
      })
      .catch((err) => console.error("Fetch Sections Error:", err));
  }, [formData.line_id]);

  // 3. โหลดข้อมูลทีม (Teams) ตาม Section ที่เลือก
  useEffect(() => {
    if (!selectedSectionId) return;

    fetch(`/api/teams?section_id=${selectedSectionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTeams(data);
          setFormData((prev) => ({ ...prev, team_id: data[0].id }));
        } else {
          setTeams([]);
          setFormData((prev) => ({ ...prev, team_id: "" }));
        }
      })
      .catch((err) => console.error("Fetch Teams Error:", err));
  }, [selectedSectionId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    // ตรวจสอบความครบถ้วนของข้อมูล
    if (
      !formData.first_name.trim() ||
      !formData.last_name.trim() ||
      !formData.employee_code.trim() ||
      !formData.password
    ) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }

    if (!formData.line_id || !formData.team_id) {
      setError("กรุณาเลือก สายการผลิต (Line) และ ทีม (Team) ให้ครบถ้วน");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: formData.password,
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          employee_code: formData.employee_code.trim(),
          position: formData.position,
          line_id: Number(formData.line_id),
          team_id: Number(formData.team_id),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "การลงทะเบียนล้มเหลว");
      }

      alert("ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบ");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่"
          : err.message || "การลงทะเบียนล้มเหลว"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="regis-container">
      <div className="regis-card">
        <h2>ลงทะเบียนพนักงานใหม่</h2>

        {/* แก้ไขเป็นตัวแปร error ให้ตรงกับ state */}
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>รหัสพนักงาน (Employee Code)</label>
            <input
              type="text"
              name="employee_code"
              placeholder="เช่น OP-69XXX"
              value={formData.employee_code}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-row form-row-2">
            <div className="form-group">
              <label>ชื่อจริง</label>
              <input
                type="text"
                name="first_name"
                placeholder="ชื่อ"
                value={formData.first_name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>นามสกุล</label>
              <input
                type="text"
                name="last_name"
                placeholder="นามสกุล"
                value={formData.last_name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row form-row-3">
            <div className="form-group">
              <label>สายการผลิต (Line)</label>
              <select name="line_id" value={formData.line_id} onChange={handleChange} required>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </div>

            {sections.length > 0 && (
              <div className="form-group">
                <label>แผนก (Section)</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  required
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>ทีม (Team)</label>
              <select name="team_id" value={formData.team_id} onChange={handleChange} required>
                {teams.length > 0 ? (
                  teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))
                ) : (
                  <option value="">-- ไม่พบทีม --</option>
                )}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>ตำแหน่ง (Position)</label>
            <select name="position" value={formData.position} onChange={handleChange} required>
              <option value="Operator A">Operator A</option>
              <option value="Technical Operator B">Technical Operator B</option>
            </select>
          </div>

          <div className="form-group">
            <label>รหัสผ่าน (Password)</label>
            <input
              type="password"
              name="password"
              placeholder="ตั้งรหัสผ่าน"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>ยืนยันรหัสผ่าน (Confirm Password)</label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="พิมพ์รหัสผ่านซ้ำอีกครั้ง"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? "กำลังบันทึกข้อมูล..." : "สมัครสมาชิก"}
          </button>
        </form>

        <div className="footer-link">
          มีบัญชีผู้ใช้งานอยู่แล้ว? <Link to="/login">เข้าสู่ระบบที่นี่</Link>
        </div>
      </div>
    </div>
  );
}

export default Register;