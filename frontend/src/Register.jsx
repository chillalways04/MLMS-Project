import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Register.css'

function Register() {
  const navigate = useNavigate();
  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    employee_code: '',
    position: 'Operator A',
    line_id: '',
    team_id: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/lines')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setLines(data);
          setFormData(prev => ({ ...prev, line_id: data[0].id }));
        }
      })
      .catch(err => console.error("Fetch Lines Error:", err));
  }, []);

  useEffect(() => {
    if (!formData.line_id) return;

    fetch(`http://localhost:5000/api/sections?line_id=${formData.line_id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSections(data);
          setSelectedSectionId(data[0].id); 
        } else {
          setSections([]);
          setSelectedSectionId('');
          setTeams([]);
          setFormData(prev => ({ ...prev, team_id: '' }));
        }
      })
      .catch(err => console.error("Fetch Sections Error:", err));
  }, [formData.line_id]);

  useEffect(() => {
    if (!selectedSectionId) return;

    fetch(`http://localhost:5000/api/teams?section_id=${selectedSectionId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTeams(data);
          setFormData(prev => ({ ...prev, team_id: data[0].id })); // ตั้งค่า team_id เริ่มต้น
        } else {
          setTeams([]);
          setFormData(prev => ({ ...prev, team_id: '' }));
        }
      })
      .catch(err => console.error("Fetch Teams Error:", err));
  }, [selectedSectionId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!formData.line_id || !formData.team_id) {
      setErrorMsg('กรุณาเลือก สายการผลิต (Line) และ ทีม (Team) ให้ถูกต้อง');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          employee_code: formData.employee_code,
          position: formData.position,
          line_id: Number(formData.line_id),
          team_id: Number(formData.team_id)
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('ลงทะเบียนพนักงานสำเร็จ!');
        navigate('/login');
      } else {
        setErrorMsg(result.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
      }
    } catch (err) {
      console.error("เกิดข้อผิดพลาดในการเชื่อมต่อ:", err);
      setErrorMsg('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="regis-container">
      <div className="regis-card">
        <h2>ลงทะเบียนพนักงานใหม่</h2>

        {errorMsg && <div className="error-banner">{errorMsg}</div>}

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

          <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
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
            <div className="form-group" style={{ flex: 1 }}>
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

          <div className="form-row" style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>สายการผลิต (Line)</label>
              <select name="line_id" value={formData.line_id} onChange={handleChange} required>
                {lines.map(line => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>

            {sections.length > 0 && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>แผนก (Section)</label>
                <select 
                  value={selectedSectionId} 
                  onChange={(e) => setSelectedSectionId(e.target.value)} 
                  required
                >
                  {sections.map(sec => (
                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group" style={{ flex: 1 }}>
              <label>ทีม (Team)</label>
              <select name="team_id" value={formData.team_id} onChange={handleChange} required>
                {teams.length > 0 ? (
                  teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
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
              <option value="Leader">Leader</option>
              <option value="Supervisor">Supervisor</option>
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
            {loading ? 'กำลังบันทึกข้อมูล...' : 'สมัครสมาชิก'}
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