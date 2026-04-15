import React from "react";
import { Card, CardContent } from "./ui";

export default function LogsPanel() {
  // 模拟日志数据
  const logs = [
    { time: "2026-03-26 10:00:00", level: "info", message: "策略启动" },
    { time: "2026-03-26 10:05:30", level: "info", message: "执行买入操作：100股" },
    { time: "2026-03-26 10:10:15", level: "info", message: "执行卖出操作：50股" },
    { time: "2026-03-26 10:15:45", level: "warning", message: "市场波动较大" },
    { time: "2026-03-26 10:20:00", level: "info", message: "策略运行正常" },
  ];

  const getLevelClass = (level: string) => {
    switch (level) {
      case "error": return "text-red-500";
      case "warning": return "text-yellow-500";
      case "info": return "text-green-500";
      default: return "text-gray-500";
    }
  };

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">策略执行日志</h2>
            <div className="muted">实时记录策略执行情况</div>
          </div>
          
          <div className="logs-container" style={{ marginTop: "1rem" }}>
            {logs.map((log, index) => (
              <div key={index} className="log-item" style={{ marginBottom: "0.5rem", padding: "0.5rem", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="log-time" style={{ fontSize: "0.875rem", color: "#666" }}>{log.time}</span>
                  <span className={`log-level ${getLevelClass(log.level)}`} style={{ fontSize: "0.75rem", fontWeight: "500" }}>
                    {log.level.toUpperCase()}
                  </span>
                </div>
                <div className="log-message" style={{ marginTop: "0.25rem", fontSize: "0.875rem" }}>
                  {log.message}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
