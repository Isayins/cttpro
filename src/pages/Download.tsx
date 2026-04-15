import React, { useCallback, useEffect, useState } from 'react';
import { Row, Col, Skeleton, Button, Empty, message } from 'antd';
import MainLayout from '../layouts/MainLayout';
import DownloadCard from '../components/DownloadCard';
import CaptchaModal from '../components/CaptchaModal';
import type { DownloadItem } from '../services/downloadService';
import { getDownloads, getFileSize } from '../services/downloadService';
import { DownloadOutlined, ClockCircleOutlined, InfoCircleOutlined, CodeOutlined } from '@ant-design/icons';

export default function Downloads() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<DownloadItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await getDownloads();
      const withSize = await Promise.all(
        (Array.isArray(json) ? json : []).map(async (it) => {
          try {
            const size = await getFileSize(it.url);
            return { ...it, size };
          } catch {
            return { ...it, size: undefined };
          }
        })
      );
      setItems(withSize);
    } catch (e) {
      console.error(e);
      setError('下载列表加载失败');
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCaptcha = (item: DownloadItem) => {
    setModalItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalItem(null);
  };

  const handleVerified = (downloadUrl: string) => {
    window.location.href = downloadUrl;
    console.log('download url', downloadUrl);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-8 mb-8 text-white">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <CodeOutlined style={{ fontSize: '28px' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">下载中心</h1>
              <p className="text-white/80">获取最新版本的软件和资源文件</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="text-gray-600">
            <span className="font-medium">{items.length}</span> 个可用资源
          </div>

          <div className="flex items-center gap-3">
            <Button 
              icon={<ClockCircleOutlined />} 
              onClick={load}
              className="gap-2"
            >
              刷新列表
            </Button>
            <Button 
              type="text" 
              icon={<InfoCircleOutlined />}
              onClick={() => message.info('如需帮助请联系管理员')}
              className="gap-2"
            >
              帮助
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-gray-50 rounded-xl p-5">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Empty 
              description={error}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={load} icon={<RefreshOutlined />}>
                重试
              </Button>
            </Empty>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <Empty 
              description="暂无下载项"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={load} icon={<RefreshOutlined />}>
                刷新
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((item, index) => (
              <div 
                key={item.url} 
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <DownloadCard 
                  {...item} 
                  onLockedClick={() => openCaptcha(item)}
                  badgeText={index === 0 ? '最新' : undefined}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-gray-50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <DownloadOutlined style={{ fontSize: '20px', color: '#3b82f6' }} />
            </div>
            <div>
              <h3 className="font-medium text-gray-800 mb-1">下载说明</h3>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• 带有 <span className="text-yellow-500 font-medium">验证</span> 标签的资源需要输入验证码才能下载</li>
                <li>• 扫描二维码可直接在手机上下载</li>
                <li>• 文件大小仅供参考，实际大小可能略有差异</li>
              </ul>
            </div>
          </div>
        </div>

        <CaptchaModal 
          open={modalOpen} 
          item={modalItem} 
          onClose={closeModal} 
          onVerified={handleVerified} 
        />
      </div>
    </MainLayout>
  );
}
