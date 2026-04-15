import React, { useState } from "react";
import { Card, CardContent } from "../components/ui";
import { Button, Input, Form, Alert } from "antd";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    
    // 模拟登录验证
    try {
      // 这里可以替换为实际的API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 简单的模拟验证
      if (values.username === "admin" && values.password === "password") {
        // 存储登录状态
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("username", values.username);
        
        // 重定向到股票页面
        navigate("/stock");
      } else {
        setError("用户名或密码错误");
      }
    } catch (e) {
      setError("登录失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh", 
      background: "#f0f2f5"
    }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" }}>
        <CardContent style={{ padding: "24px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>CTT Pro 登录</h2>
            <p style={{ margin: "8px 0 0 0", color: "#666" }}>量化交易控制台</p>
          </div>
          
          {error && (
            <Alert 
              message="登录失败" 
              description={error} 
              type="error" 
              showIcon 
              style={{ marginBottom: "16px" }}
            />
          )}
          
          <Form 
            name="login" 
            onFinish={handleLogin}
            layout="vertical"
          >
            <Form.Item 
              name="username" 
              label="用户名"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>
            
            <Form.Item 
              name="password" 
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
            
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                style={{ width: "100%", height: "40px", fontSize: "16px" }}
                loading={loading}
              >
                登录
              </Button>
            </Form.Item>
            
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <p style={{ margin: 0, color: "#666", fontSize: "14px" }}>
                测试账号: admin / 密码: password
              </p>
            </div>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
