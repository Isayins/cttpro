import React, { useState } from "react";
import { Card, CardContent } from "./ui";
import { InputNumber, Button, Form, Select } from "antd";

const { Option } = Select;

export default function ConfigPanel() {
  const [form] = Form.useForm();
  
  // 初始参数值
  const initialValues = {
    buyThreshold: 0.02,
    sellThreshold: 0.03,
    maxPosition: 10000,
    stopLoss: 0.05,
    takeProfit: 0.1,
    strategyType: "trend",
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      // 模拟保存操作
      console.log("保存的参数:", values);
      alert("策略参数已保存");
    });
  };

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <h2 className="section-title">策略参数配置</h2>
            <div className="muted">调整策略的各项参数</div>
          </div>
          
          <Form 
            form={form}
            initialValues={initialValues}
            style={{ marginTop: "1rem" }}
          >
            <Form.Item 
              name="strategyType" 
              label="策略类型"
              rules={[{ required: true, message: "请选择策略类型" }]}
              style={{ marginBottom: "1rem" }}
            >
              <Select style={{ width: "100%" }}>
                <Option value="trend">趋势策略</Option>
                <Option value="meanReversion">均值回归</Option>
                <Option value="momentum">动量策略</Option>
                <Option value="breakout">突破策略</Option>
              </Select>
            </Form.Item>
            
            <Form.Item 
              name="buyThreshold" 
              label="买入阈值"
              rules={[{ required: true, message: "请输入买入阈值" }]}
              style={{ marginBottom: "1rem" }}
            >
              <InputNumber 
                min={0} 
                max={1} 
                step={0.01} 
                style={{ width: "100%" }}
                formatter={(value) => `${(value * 100).toFixed(2)}%`}
                parser={(value) => parseFloat(value.replace('%', '')) / 100}
              />
            </Form.Item>
            
            <Form.Item 
              name="sellThreshold" 
              label="卖出阈值"
              rules={[{ required: true, message: "请输入卖出阈值" }]}
              style={{ marginBottom: "1rem" }}
            >
              <InputNumber 
                min={0} 
                max={1} 
                step={0.01} 
                style={{ width: "100%" }}
                formatter={(value) => `${(value * 100).toFixed(2)}%`}
                parser={(value) => parseFloat(value.replace('%', '')) / 100}
              />
            </Form.Item>
            
            <Form.Item 
              name="maxPosition" 
              label="最大仓位"
              rules={[{ required: true, message: "请输入最大仓位" }]}
              style={{ marginBottom: "1rem" }}
            >
              <InputNumber 
                min={1000} 
                max={100000} 
                step={1000} 
                style={{ width: "100%" }}
              />
            </Form.Item>
            
            <Form.Item 
              name="stopLoss" 
              label="止损比例"
              rules={[{ required: true, message: "请输入止损比例" }]}
              style={{ marginBottom: "1rem" }}
            >
              <InputNumber 
                min={0} 
                max={1} 
                step={0.01} 
                style={{ width: "100%" }}
                formatter={(value) => `${(value * 100).toFixed(2)}%`}
                parser={(value) => parseFloat(value.replace('%', '')) / 100}
              />
            </Form.Item>
            
            <Form.Item 
              name="takeProfit" 
              label="止盈比例"
              rules={[{ required: true, message: "请输入止盈比例" }]}
              style={{ marginBottom: "1rem" }}
            >
              <InputNumber 
                min={0} 
                max={1} 
                step={0.01} 
                style={{ width: "100%" }}
                formatter={(value) => `${(value * 100).toFixed(2)}%`}
                parser={(value) => parseFloat(value.replace('%', '')) / 100}
              />
            </Form.Item>
            
            <Button 
              type="primary" 
              onClick={handleSave}
              style={{ marginTop: "1rem" }}
            >
              保存参数
            </Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
