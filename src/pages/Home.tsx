import MainLayout from "../layouts/MainLayout";
import { Row, Col, Button } from 'antd';
import { Card, CardContent } from "../components/ui";
import React from "react";
import { BarChartOutlined, CodeOutlined, FileTextOutlined, ToolOutlined } from "@ant-design/icons";

const galleryImages = [
  {
    id: 1, 
    title: '数据可视化', 
    description: '实时数据展示',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimalist%20data%20visualization%20dashboard%20with%20charts%20and%20graphs%20clean%20design&image_size=landscape_4_3'
  },
  {
    id: 2, 
    title: '量化策略', 
    description: '智能交易算法',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=programming%20code%20on%20screen%20with%20mathematical%20formulas%20dark%20theme&image_size=landscape_4_3'
  },
  {
    id: 3, 
    title: '工具集合', 
    description: '实用开发工具',
    image: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20software%20development%20tools%20workspace%20clean%20minimal&image_size=landscape_4_3'
  }
];

const features = [
  {
    title: '实时行情',
    icon: <BarChartOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
    description: '实时获取市场数据'
  },
  {
    title: '策略开发',
    icon: <CodeOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
    description: '编写和测试交易策略'
  },
  {
    title: '日志分析',
    icon: <FileTextOutlined style={{ fontSize: '24px', color: '#faad14' }} />,
    description: '查看策略执行记录'
  },
  {
    title: '实用工具',
    icon: <ToolOutlined style={{ fontSize: '24px', color: '#f5222d' }} />,
    description: '辅助开发和分析工具'
  }
];

export default function Home() {
  return (
    <MainLayout>
      <div className="py-8">
        <div className="text-center mb-12">
          <h1 className="text-2xl font-medium text-gray-800 mb-4">个人技术空间</h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            记录技术探索，分享量化交易相关的实践与工具
          </p>
        </div>
        
        <div className="mb-12">
          <h2 className="text-lg font-medium text-gray-700 mb-6 text-center">项目展示</h2>
          <Row gutter={[16, 16]}>
            {galleryImages.map((item) => (
              <Col xs={24} sm={12} md={8} key={item.id}>
                <Card hoverable>
                  <CardContent>
                    <div className="relative overflow-hidden rounded-lg mb-4" style={{ height: '160px' }}>
                      <img 
                        src={item.image} 
                        alt={item.title} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h3 className="text-base font-medium text-gray-800 mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </CardContent>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
        
        <div className="mb-12">
          <h2 className="text-lg font-medium text-gray-700 mb-6 text-center">功能概览</h2>
          <Row gutter={[16, 16]}>
            {features.map((feature, index) => (
              <Col xs={24} sm={12} md={6} key={index}>
                <Card>
                  <CardContent style={{ textAlign: 'center' }}>
                    <div className="mb-3">{feature.icon}</div>
                    <h3 className="text-base font-medium text-gray-800 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </CardContent>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <p className="text-gray-600 text-center text-sm">
            这是一个个人项目，用于学习和实践量化交易相关技术
          </p>
        </div>
      </div>
    </MainLayout>
  );
}

