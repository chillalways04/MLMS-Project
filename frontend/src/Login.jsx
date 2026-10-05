import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Login.css";

function Login() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    if (!employeeCode.trim() || !password) {
      setError("กรุณากรอกรหัสพนักงานและรหัสผ่าน");
      return;
    }

    setLoading(true);

    try {
      // ล้างข้อมูลการเข้าสู่ระบบครั้งก่อน
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // ใช้ /api/login แบบ Relative Path เพื่อรองรับการเข้าถึงจากภายนอก/มือถือ
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_code: employeeCode.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "เข้าสู่ระบบล้มเหลว");
      }

      // Backend ต้องส่ง token และข้อมูลผู้ใช้กลับมา
      if (
        typeof data.token !== "string" ||
        !data.token ||
        !data.user ||
        data.user.id == null ||
        data.user.role_id == null
      ) {
        throw new Error(
          "ข้อมูลเข้าสู่ระบบไม่ครบ กรุณาตรวจสอบว่า backend เพิ่ม JWT แล้ว"
        );
      }

      // บันทึกข้อมูลผู้ใช้และ token สำหรับเรียก API
      localStorage.setItem("user", JSON.stringify(data.user));

      try {
        localStorage.setItem("token", data.token);
      } catch (storageError) {
        localStorage.removeItem("user");
        throw storageError;
      }

      // ใช้ role_id เพื่อเลือกหน้าที่จะแสดง
      const roleId = Number(data.user.role_id);

      if (roleId === 3) {
        navigate("/", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่"
          : err.message || "เข้าสู่ระบบล้มเหลว"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    alert(
      "หากลืมรหัสผ่าน กรุณาติดต่อ Supervisor หรือหัวหน้างานประจำ Line ของคุณเพื่อทำการรีเซ็ตรหัสผ่าน"
    );
  };

  return (
    <div className="container">
      <form onSubmit={handleSubmit} className="card-1">
        <h2>เข้าสู่ระบบ</h2>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <label htmlFor="employee-code">Username</label>
        <input
          id="employee-code"
          type="text"
          placeholder="รหัสพนักงาน (Username)"
          value={employeeCode}
          onChange={(e) => setEmployeeCode(e.target.value)}
          autoComplete="username"
          disabled={loading}
          required
        />

        <label htmlFor="password">Password</label>
        <div className="password-input-wrapper">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="รหัสผ่าน (Password)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
            required
          />

          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword((previous) => !previous)}
            title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={showPassword}
          >
            <i
              className={`fa-solid ${
                showPassword ? "fa-eye" : "fa-eye-slash"
              }`}
              aria-hidden="true"
            />
          </button>
        </div>

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
          disabled={loading}
        >
          ลงทะเบียน
        </button>
      </form>
    </div>
  );
}

export default Login;