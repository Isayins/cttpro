import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

// 检查用户是否已登录
const isLoggedIn = () => {
  return localStorage.getItem("isLoggedIn") === "true";
};

export default function ProtectedRoute() {
  const location = useLocation();
  
  if (!isLoggedIn()) {
    // 重定向到登录页面，并在登录后返回当前页面
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <Outlet />;
}
