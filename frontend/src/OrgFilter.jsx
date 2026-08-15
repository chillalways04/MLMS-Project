import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import './OrgFilter.css'; 

function OrgFilter() {
  const navigate = useNavigate();

  const [user] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [lines, setLines] = useState([]);
  const [sections, setSections] = useState([]);
  const [teams, setTeams] = useState([]);

  const [selectedLine, setSelectedLine] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLines = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/lines');
        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลไลน์ผลิตได้');
        const data = await response.json();
        setLines(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLines();
  }, []);

  useEffect(() => {
    if (!selectedLine) return;

    const fetchSections = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/sections?line_id=${selectedLine}`);
        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลแผนก (Section) ได้');
        const data = await response.json();
        setSections(data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchSections();
  }, [selectedLine]);

  useEffect(() => {
    if (!selectedSection) return;

    const fetchTeams = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/teams?section_id=${selectedSection}`);
        if (!response.ok) throw new Error('ไม่สามารถดึงข้อมูลทีม (Team) ได้');
        const data = await response.json();
        setTeams(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchTeams();
  }, [selectedSection]);

  const handleLogout = () => {
    if (window.confirm("คุณต้องการออกจากระบบใช่หรือไม่?")) {
      localStorage.removeItem("user");
      navigate("/login");
    }
  };

  const handleLineChange = (e) => {
    const value = e.target.value;
    setSelectedLine(value);
    if (!value) {
      setSections([]);
      setTeams([]);
    }
    setSelectedSection('');
    setSelectedTeam('');
  };

  const handleSectionChange = (e) => {
    const value = e.target.value;
    setSelectedSection(value);
    if (!value) {
      setTeams([]);
    }
    setSelectedTeam('');
  };

  if (error) return <div className="org-container"><p className="error-message">เกิดข้อผิดพลาด: {error}</p></div>;

  const selectedLineName = lines.find(l => String(l.id) === String(selectedLine))?.name || '';
  const selectedSectionName = sections.find(s => String(s.id) === String(selectedSection))?.name || '';
  const selectedTeamName = teams.find(t => String(t.id) === String(selectedTeam))?.name || '';

  return (
    <div className="org-container">
      <h2 className="org-title">ระบบกรองข้อมูลโครงสร้างองค์กร (MLMS Filter)</h2>

      {user && (
        <div className="user-card">
          <div className="avatar">
            {user.first_name ? user.first_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="user-info">
            <h3>ยินดีต้อนรับ, คุณ{user.first_name} {user.last_name}</h3>
             <p>รหัสพนักงาน: <strong>{user.employee_code}</strong> | ตำแหน่ง: <span className="badge">{user.position}</span></p>
          </div>
        </div>
      )}

      {loading && <p className="loading-text">กำลังโหลดข้อมูลเริ่มต้น...</p>}

      <div className="filter-form">
        <div className="form-field">
          <label>1. ไลน์ผลิต (Line):</label>
          <select value={selectedLine} onChange={handleLineChange} className="select-input">
            <option value="">-- กรุณาเลือกไลน์ --</option>
            {lines.map((line) => (
              <option key={line.id} value={line.id}>{line.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>2. แผนก (Section):</label>
          <select
            value={selectedSection}
            onChange={handleSectionChange}
            disabled={!selectedLine}
            className="select-input"
          >
            <option value="">-- กรุณาเลือกแผนก --</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>{sec.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>3. ทีมย่อย (Team):</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            disabled={!selectedSection}
            className="select-input"
          >
            <option value="">-- กรุณาเลือกทีม --</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedTeam && (
        <div className="summary-box">
          <span className="summary-title">สรุปตัวกรองปัจจุบัน:</span>
          <div>Line: <strong>{selectedLineName}</strong> | Section: <strong>{selectedSectionName}</strong> | Team: <strong>{selectedTeamName}</strong></div>
        </div>
      )}

      <button className="btn-back" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

export default OrgFilter;