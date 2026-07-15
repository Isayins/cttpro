import StatusState from "../components/StatusState";
import MainLayout from "../layouts/MainLayout";
import { routePaths } from "../router/routeAccess";

export default function NotFound() {
  return (
    <MainLayout>
      <div className="py-10">
        <StatusState
          variant="notfound"
          title="这个页面好像走丢了"
          description="你访问的地址不存在，可能是链接过期、地址输错，或者这个页面已经被调整了。可以返回上一页，或者回到首页继续浏览。"
          backLabel="返回上一页"
          primaryLabel="返回首页"
          primaryTo={routePaths.home}
          secondaryLabel="登录账号"
          secondaryTo={routePaths.login}
        />
      </div>
    </MainLayout>
  );
}
