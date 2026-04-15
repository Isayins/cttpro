import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import About from "../pages/About";
import Downloads from "../pages/Download";
import Tools from "../pages/Tools";
import VerifyDownload from "../pages/VerifyDownload";
import Stock from "../pages/Stock";
import Login from "../pages/Login";
import ProtectedRoute from "../components/ProtectedRoute";

export default function RouterConfig() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/verify" element={<VerifyDownload />} />
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/stock" element={<Stock />} />
      </Route>
    </Routes>
  );
}
