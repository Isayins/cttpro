import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "../context/useAuth";
import { buildRedirectFromLocation } from "../router/authRedirect";
import { routePaths } from "../router/routeAccess";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const location = useLocation();
  const { initializing, isAuthenticated, isAdmin } = useAuth();
  const from = buildRedirectFromLocation(location);

  if (initializing) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={routePaths.login} state={{ from }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to={routePaths.forbidden} state={{ from }} replace />;
  }

  return <>{children}</>;
}
