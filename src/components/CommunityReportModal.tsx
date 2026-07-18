import { useState } from "react";
import { Button, Form, Input, Modal, Select, message } from "antd";

import { getErrorMessage } from "../lib/errorMessage";
import {
  reportCommunityContent,
  type CommunityReportTarget,
} from "../services/communityService";

type ReportFormValues = {
  reason: string;
  detail?: string;
};

const reasonOptions = [
  { label: "垃圾广告", value: "垃圾广告" },
  { label: "辱骂或骚扰", value: "辱骂或骚扰" },
  { label: "违法违规", value: "违法违规" },
  { label: "泄露隐私", value: "泄露隐私" },
  { label: "其他问题", value: "其他问题" },
];

export default function CommunityReportModal({
  target,
  onClose,
}: {
  target: CommunityReportTarget | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<ReportFormValues>();
  const [submitting, setSubmitting] = useState(false);

  function close() {
    form.resetFields();
    onClose();
  }

  async function submit(values: ReportFormValues) {
    if (!target) {
      return;
    }
    setSubmitting(true);
    try {
      await reportCommunityContent({
        targetType: target.targetType,
        targetId: target.targetId,
        reason: values.reason,
        detail: values.detail?.trim(),
      });
      message.success("举报已提交，管理员会尽快处理");
      close();
    } catch (error) {
      message.error(getErrorMessage(error, "举报提交失败"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={target ? `举报：${target.label}` : "举报社区内容"}
      open={Boolean(target)}
      onCancel={close}
      footer={null}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(values) => void submit(values)}>
        <Form.Item
          name="reason"
          label="举报原因"
          rules={[{ required: true, message: "请选择举报原因" }]}
        >
          <Select options={reasonOptions} placeholder="选择最接近的问题" />
        </Form.Item>
        <Form.Item name="detail" label="补充说明">
          <Input.TextArea rows={4} maxLength={500} showCount />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={close} disabled={submitting}>取消</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交举报
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
