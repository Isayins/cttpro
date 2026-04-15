import React, { useState } from "react";
import { Card, CardContent } from "./ui";
import { Switch, Input, Button } from "antd";

export default function NotificationsPanel() {
  const [email, setEmail] = useState("user@example.com");
  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    dailySummary: true,
    errorAlerts: true,
    marketUpdates: false,
  });

  const handleNotificationChange = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    // 模拟保存操作
    alert("邮件通知设置已保存");
  };

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">邮件通知设置</h2>
            <div className="muted">配置策略相关的邮件通知</div>
          </div>
          
          <div style={{ marginTop: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>邮箱地址</label>
              <Input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入您的邮箱地址"
                style={{ width: "100%" }}
              />
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "500" }}>通知类型</label>
              
              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>交易提醒</span>
                <Switch 
                  checked={notifications.tradeAlerts} 
                  onChange={() => handleNotificationChange("tradeAlerts")}
                />
              </div>
              
              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>每日总结</span>
                <Switch 
                  checked={notifications.dailySummary} 
                  onChange={() => handleNotificationChange("dailySummary")}
                />
              </div>
              
              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>错误警报</span>
                <Switch 
                  checked={notifications.errorAlerts} 
                  onChange={() => handleNotificationChange("errorAlerts")}
                />
              </div>
              
              <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>市场更新</span>
                <Switch 
                  checked={notifications.marketUpdates} 
                  onChange={() => handleNotificationChange("marketUpdates")}
                />
              </div>
            </div>
            
            <Button 
              type="primary" 
              onClick={handleSave}
              style={{ marginTop: "1rem" }}
            >
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
