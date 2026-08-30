import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./login";
import OrgFilter from "./OrgFilter";
import Dashboard from "./Dashboard";
import Certificate from "./Certificate";
import VerifyCertificate from "./VerifyCertificate";
import Register from "./Register";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OrgFilter/>} />
        <Route path="/login" element={<Login/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/certificate" element={<Certificate/>} />
        <Route path="/verify/:uuid" element={<VerifyCertificate/>} /> 
        <Route path="/register" element={<Register/>}/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;