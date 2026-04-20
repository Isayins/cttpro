import { useMemo } from "react";
import { Button, Form, InputNumber, Select, Space, message } from "antd";

import { Card, CardContent } from "./ui";

type StrategyType = "trend" | "meanReversion" | "momentum" | "breakout";

interface StrategyConfigValues {
  buyThreshold: number;
  sellThreshold: number;
  maxPosition: number;
  stopLoss: number;
  takeProfit: number;
  strategyType: StrategyType;
}

const STORAGE_KEY = "quant.strategy.config";

const DEFAULT_VALUES: StrategyConfigValues = {
  buyThreshold: 0.02,
  sellThreshold: 0.03,
  maxPosition: 10000,
  stopLoss: 0.05,
  takeProfit: 0.1,
  strategyType: "trend",
};

function readStoredConfig(): StrategyConfigValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VALUES;
    }

    const parsed = JSON.parse(raw) as Partial<StrategyConfigValues>;
    return {
      ...DEFAULT_VALUES,
      ...parsed,
    };
  } catch {
    return DEFAULT_VALUES;
  }
}

function writeStoredConfig(values: StrategyConfigValues) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

function parsePercentInput(value: string | undefined) {
  const normalized = String(value ?? "")
    .replace("%", "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

export default function ConfigPanel() {
  const [form] = Form.useForm<StrategyConfigValues>();
  const initialValues = useMemo(() => readStoredConfig(), []);

  const handleFinish = (values: StrategyConfigValues) => {
    writeStoredConfig(values);
    message.success("Parameters saved locally in this browser.");
  };

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_VALUES);
    writeStoredConfig(DEFAULT_VALUES);
    message.success("Parameters reset to defaults.");
  };

  return (
    <div className="page-stack">
      <Card>
        <CardContent>
          <div className="section-head">
            <div>
              <h2 className="section-title">Strategy Parameters</h2>
              <div className="muted">
                These settings are stored locally in your current browser until a backend config API is wired in.
              </div>
            </div>
          </div>

          <Form<StrategyConfigValues>
            form={form}
            initialValues={initialValues}
            layout="vertical"
            onFinish={handleFinish}
            style={{ marginTop: "1rem" }}
          >
            <Form.Item
              name="strategyType"
              label="Strategy Type"
              rules={[{ required: true, message: "Select a strategy type." }]}
            >
              <Select
                options={[
                  { value: "trend", label: "Trend Following" },
                  { value: "meanReversion", label: "Mean Reversion" },
                  { value: "momentum", label: "Momentum" },
                  { value: "breakout", label: "Breakout" },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="buyThreshold"
              label="Buy Threshold"
              rules={[{ required: true, message: "Enter the buy threshold." }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                style={{ width: "100%" }}
                formatter={(value) => `${(Number(value ?? 0) * 100).toFixed(2)}%`}
                parser={parsePercentInput}
              />
            </Form.Item>

            <Form.Item
              name="sellThreshold"
              label="Sell Threshold"
              rules={[{ required: true, message: "Enter the sell threshold." }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                style={{ width: "100%" }}
                formatter={(value) => `${(Number(value ?? 0) * 100).toFixed(2)}%`}
                parser={parsePercentInput}
              />
            </Form.Item>

            <Form.Item
              name="maxPosition"
              label="Max Position"
              rules={[{ required: true, message: "Enter the max position size." }]}
            >
              <InputNumber min={1000} max={100000} step={1000} style={{ width: "100%" }} />
            </Form.Item>

            <Form.Item
              name="stopLoss"
              label="Stop Loss"
              rules={[{ required: true, message: "Enter the stop loss value." }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                style={{ width: "100%" }}
                formatter={(value) => `${(Number(value ?? 0) * 100).toFixed(2)}%`}
                parser={parsePercentInput}
              />
            </Form.Item>

            <Form.Item
              name="takeProfit"
              label="Take Profit"
              rules={[{ required: true, message: "Enter the take profit value." }]}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.01}
                style={{ width: "100%" }}
                formatter={(value) => `${(Number(value ?? 0) * 100).toFixed(2)}%`}
                parser={parsePercentInput}
              />
            </Form.Item>

            <Space wrap>
              <Button type="primary" htmlType="submit">
                Save Parameters
              </Button>
              <Button onClick={handleReset}>Reset Defaults</Button>
            </Space>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
