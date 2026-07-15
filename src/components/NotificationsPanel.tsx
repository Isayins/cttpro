import { useState } from "react";
import { Button, Input, Switch, message } from "antd";

import { Card, CardContent } from "./ui";

export default function NotificationsPanel() {
  const [email, setEmail] = useState("");
  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    dailySummary: true,
    errorAlerts: true,
    marketUpdates: false,
  });

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const handleSave = () => {
    message.success("通知设置已保存。");
  };

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">通知设置</h2>
            <div className="muted">配置交易提醒、日报和异常通知的接收方式。</div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>邮箱地址</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入接收通知的邮箱"
                style={{ width: "100%" }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>通知类型</label>

              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>交易提醒</span>
                <Switch checked={notifications.tradeAlerts} onChange={() => handleNotificationChange("tradeAlerts")} />
              </div>

              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>每日日报</span>
                <Switch checked={notifications.dailySummary} onChange={() => handleNotificationChange("dailySummary")} />
              </div>

              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>错误警报</span>
                <Switch checked={notifications.errorAlerts} onChange={() => handleNotificationChange("errorAlerts")} />
              </div>

              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>市场更新</span>
                <Switch checked={notifications.marketUpdates} onChange={() => handleNotificationChange("marketUpdates")} />
              </div>
            </div>

            <Button type="primary" onClick={handleSave} style={{ marginTop: "1rem" }}>
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
