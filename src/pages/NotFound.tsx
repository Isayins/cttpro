import StatusState from "../components/StatusState";
import MainLayout from "../layouts/MainLayout";

export default function NotFound() {
  return (
    <MainLayout>
      <div className="py-10">
        <StatusState
          variant="notfound"
          title="这个页面好像走丢了"
          description="你访问的地址不存在，可能是链接过期、地址输错，或者这个页面已经被调整了。可以回到首页继续浏览。"
          primaryLabel="返回首页"
          primaryTo="/"
          secondaryLabel="打开下载中心"
          secondaryTo="/downloads"
        />
      </div>
    </MainLayout>
  );
}
