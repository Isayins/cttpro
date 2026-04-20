import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import About from "../pages/About";
import Admin from "../pages/Admin";
import ChatRoom from "../pages/ChatRoom";
import Download from "../pages/Download";
import Forbidden from "../pages/Forbidden";
import Forum from "../pages/Forum";
import Home from "../pages/Home";
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";
import Profile from "../pages/Profile";
import QrAccess from "../pages/QrAccess";
import QrManage from "../pages/QrManage";
import RandomTalk from "../pages/RandomTalk";
import Stock from "../pages/Stock";
import Tools from "../pages/Tools";
import VerifyDownload from "../pages/VerifyDownload";

export default function RouterConfig() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/downloads" element={<Download />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/randomtalk" element={<RandomTalk />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatRoom />
          </ProtectedRoute>
        }
      />
      <Route path="/verify" element={<VerifyDownload />} />
      <Route path="/q/:shortCode" element={<QrAccess />} />
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <Stock />
          </ProtectedRoute>
        }
      />
      <Route
        path="/forum"
        element={
          <ProtectedRoute>
            <Forum />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/qrcodes"
        element={
          <ProtectedRoute adminOnly>
            <QrManage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
