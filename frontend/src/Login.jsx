import { useNavigate } from "react-router-dom";
import "./Login.css";
import { useState } from "react";

function Login() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); 

    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_code: employeeCode,
          password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "เข้าสู่ระบบล้มเหลว");
      }

      alert("เข้าสู่ระบบสำเร็จ!");
      
      localStorage.setItem("user", JSON.stringify(data.user));
      const empCode = data.user.employee_code.toUpperCase();
      const prefix = empCode.substring(0, 2);
      if (prefix === "SV") {
        navigate("/");
      } else {
        navigate("/dashboard"); 
      }
      
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert("หากลืมรหัสผ่าน กรุณาติดต่อ Supervisor หรือหัวหน้างานประจำ Line ของคุณเพื่อทำการรีเซ็ตรหัสผ่าน");
  };

  return (
    <div className="container">
      <form onSubmit={handleSubmit} className="card-1">
        <h2>เข้าสู่ระบบ</h2>

        {error && <p className="error-message">{error}</p>}
        
        
        <label>Username</label>
        <input
          type="text"
          placeholder="รหัสพนักงาน (Username)"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          required
        />
        
        <label>Password</label>
        <input
          type="password"
          placeholder="รหัสผ่าน (Password)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <h3 
          className="forgot-password-link"
          onClick={handleForgotPassword}
        >
          ลืมรหัสผ่าน?
        </h3>

        <button type="submit" disabled={loading}>
          {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
        </button>

        <h1> ――――――――― หรือ ――――――――― </h1>
        <h4>ยังไม่มีบัญชีผู้ใช้งาน?</h4>

        <button 
          type="button" 
          className="regis-btn" 
          onClick={() => navigate("/register")}
        >
          ลงทะเบียน
        </button>
      </form>
    </div>
  );
}

export default Login;