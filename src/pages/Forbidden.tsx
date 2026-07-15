import { useLocation } from "react-router-dom";

import StatusState from "../components/StatusState";
import MainLayout from "../layouts/MainLayout";
import { routePaths } from "../router/routeAccess";

export default function Forbidden() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <MainLayout>
      <div className="py-10">
        <StatusState
          variant="forbidden"
          title="这个页面暂时不对你开放"
          description={
            from
              ? `你当前没有访问 ${from} 的权限。如果你认为这是误判，可以先确认账号角色，或者联系管理员处理。`
              : "你当前没有访问这个页面的权限。如果你认为这是误判，可以先确认账号角色，或者联系管理员处理。"
          }
          backLabel="返回上一页"
          primaryLabel="返回首页"
          primaryTo={routePaths.home}
          secondaryLabel="查看账号"
          secondaryTo={routePaths.profile}
        />
      </div>
    </MainLayout>
  );
}
