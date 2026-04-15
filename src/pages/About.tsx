import MainLayout from "../layouts/MainLayout";
import { Card, CardContent } from "../components/ui";
import { Row, Col } from "antd";
import { CodeOutlined, BarChartOutlined, BookOutlined, GithubOutlined } from "@ant-design/icons";

export default function About() {
  const skills = [
    { name: 'Python', level: '啥也不懂' },
    { name: 'TypeScript', level: '啥也不懂' },
    { name: 'React', level: '啥也不懂' },
    { name: '量化交易', level: '啥也不懂' },
    { name: '数据分析', level: '啥也不懂' },
    { name: '机器学习', level: '啥也不懂' },
  ];

  const projects = [
    {
      title: '量化交易系统',
      description: '基于TuShare数据的实时行情分析平台',
      icon: <BarChartOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
    },
    {
      title: '工具集合',
      description: 'JSON格式化、时间戳转换等实用工具',
      icon: <CodeOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
    },
    {
      title: '技术博客',
      description: '记录技术学习和实践经验',
      icon: <BookOutlined style={{ fontSize: '20px', color: '#faad14' }} />
    }
  ];

  return (
    <MainLayout>
      <div className="py-8">
        <h1 className="text-2xl font-medium text-center mb-8">关于我</h1>
        
        <div className="mb-12">
          <Card>
            <CardContent>
              <h2 className="text-lg font-medium mb-4">个人简介</h2>
              <p className="text-gray-600 mb-4">
                啥也不会的开发者，整天瞎折腾。代码写得稀烂，bug比头发还多。
              </p>
              <p className="text-gray-600">
                摸鱼空间，记录各种失败的尝试和半成品项目。
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mb-12">
          <h2 className="text-lg font-medium mb-6 text-center">技能栈</h2>
          <Row gutter={[12, 12]}>
            {skills.map((skill, index) => (
              <Col xs={12} sm={8} md={6} key={index}>
                <Card>
                  <CardContent style={{ textAlign: 'center', padding: '12px' }}>
                    <span className="text-gray-700">{skill.name}</span>
                    <span className="text-gray-400 ml-2">({skill.level})</span>
                  </CardContent>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
        
        <div className="mb-12">
          <h2 className="text-lg font-medium mb-6 text-center">项目列表</h2>
          <Row gutter={[16, 16]}>
            {projects.map((project, index) => (
              <Col xs={24} sm={12} md={8} key={index}>
                <Card hoverable>
                  <CardContent>
                    <div className="mb-3">{project.icon}</div>
                    <h3 className="text-base font-medium mb-2">{project.title}</h3>
                    <p className="text-sm text-gray-500">{project.description}</p>
                  </CardContent>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
        
        <div className="mb-12">
          <Card>
            <CardContent>
              <h2 className="text-lg font-medium mb-4">联系方式</h2>
              <div className="flex items-center gap-4">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                  <GithubOutlined />
                  <span>Github</span>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6">
          <p className="text-gray-500 text-center text-sm">
            感谢访问我的个人网站，欢迎交流和反馈！
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
