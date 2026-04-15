// src/components/DownloadCard.tsx
import React, { useMemo } from 'react';
import { Card, Row, Col, Avatar, Tag, Popover, Typography, Space, Button, Tooltip } from 'antd';
import { DownloadOutlined, LockOutlined, LinkOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { QRCode } from 'antd';
import type { DownloadItem } from '../services/downloadService';

export type { DownloadItem } from '../services/downloadService';

const { Paragraph, Text } = Typography;

// Constants for styling
const STYLES = {
  card: {
    borderRadius: 14,
    overflow: 'visible' as const,
    boxShadow: '0 6px 20px rgba(16,24,40,0.04)',
  },
  body: { padding: 16 },
  avatar: {
    borderRadius: 12,
    boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
  },
  qrContainer: {
    display: 'inline-block',
    background: '#fff',
    padding: 6,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(2,6,23,0.06)',
  },
  qrPopoverContent: {
    padding: 8,
    background: '#fff',
    borderRadius: 12,
  },
  changelogBox: {
    margin: 0,
    background: '#FAFBFC',
    padding: 10,
    borderRadius: 8,
  },
  actionSection: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
};

const QR_SIZES = {
  small: 100,
  large: 220,
};

type Props = DownloadItem & {
  onLockedClick?: () => void;
  badgeText?: string;
};

/**
 * Ant Design Style Download Card
 * - Left info column, right QR code (fixed width), bottom action buttons
 * - Uses Popover for enlarged QR code (hover/click)
 */
export default function DownloadCard({
  title,
  version,
  changelog,
  url,
  icon,
  locked,
  size,
  onLockedClick,
  badgeText,
}: Props) {
  const safeUrl = url ?? '';
  
  const verifyUrl = useMemo(() => {
    return `https://idncar.com/#/verify?resource=${encodeURIComponent(safeUrl)}`;
  }, [safeUrl]);

  const handleDownload = (e: React.MouseEvent) => {
    if (locked) {
      e.preventDefault();
      onLockedClick?.();
    }
  };

  return (
    <Card
      hoverable
      style={STYLES.card}
      bodyStyle={STYLES.body}
    >
      <Row gutter={[16, 12]} align="middle">
        {/* Left Info Column */}
        <Col xs={24} sm={18} style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar
              src={icon || '/images/idncar.jpg'}
              shape="square"
              size={56}
              style={STYLES.avatar}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text 
                  strong 
                  style={{ fontSize: 16 }} 
                  ellipsis={{ tooltip: title }}
                  title={title}
                >
                  {title}
                </Text>
                <Tooltip title="More Information">
                  <InfoCircleOutlined style={{ color: '#9CA3AF' }} />
                </Tooltip>
                {badgeText && <Tag color="magenta" style={{ marginLeft: 8 }}>{badgeText}</Tag>}
              </div>

              <div style={{ marginTop: 6, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Version: {version ?? 'Unknown'}</Text>
                {size && <Text type="secondary" style={{ fontSize: 12 }}>· Size: {size}</Text>}
                {locked ? (
                  <Tag icon={<LockOutlined />} color="warning" style={{ marginLeft: 4 }}>Verification Required</Tag>
                ) : (
                  <Tag color="processing" style={{ marginLeft: 4 }}>Direct Download</Tag>
                )}
              </div>

              <div style={{ marginTop: 10 }}>
                {changelog ? (
                  <Paragraph
                    ellipsis={{ rows: 2, expandable: true, symbol: 'More' }}
                    style={STYLES.changelogBox}
                  >
                    {changelog}
                  </Paragraph>
                ) : (
                  <div style={{ color: '#9CA3AF', fontSize: 13 }}>No changelog available</div>
                )}
              </div>
            </div>
          </div>
        </Col>

        {/* Right QR Code Column */}
        <Col xs={24} sm={6} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <Popover
              content={<div style={STYLES.qrPopoverContent}><QRCode value={verifyUrl} size={QR_SIZES.large} /></div>}
              trigger={['hover', 'click']}
              overlayStyle={{ padding: 0 }}
              mouseEnterDelay={0.12}
              mouseLeaveDelay={0.12}
            >
              <div style={STYLES.qrContainer}>
                <QRCode value={verifyUrl} size={QR_SIZES.small} />
              </div>
            </Popover>
            <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>扫码下载</div>
          </div>
        </Col>

        {/* Bottom Action Buttons */}
        <Col span={24}>
          <div style={STYLES.actionSection}>
            <Space style={{ flex: 1 }}>
              {locked ? (
                <Button 
                  type="primary" 
                  icon={<LockOutlined />} 
                  onClick={onLockedClick} 
                  style={{ minWidth: 160 }}
                  aria-label="Enter verification code to download"
                >
                  输入验证码下载
                </Button>
              ) : (
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />} 
                  href={safeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ minWidth: 160 }}
                  aria-label="Direct download"
                >
                  直接下载
                </Button>
              )}

              <Button 
                icon={<LinkOutlined />} 
                href={safeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Copy direct link"
              >
                直链
              </Button>
            </Space>

            <div style={{ marginLeft: 'auto' }}>
              {/* Reserved for secondary actions */}
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
}