import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../context/useAuth";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const location = useLocation();
  const { initializing, isAuthenticated, isAdmin } = useAuth();

  if (initializing) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/403" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
