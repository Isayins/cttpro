import MainLayout from '../layouts/MainLayout';
import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '../components/ui';
import { Row, Col, Button, Input, Alert } from 'antd';
import { CopyOutlined, DeleteOutlined, CodeOutlined, CheckCircleOutlined, WarningOutlined, ClockCircleOutlined, LinkOutlined, KeyOutlined, QrcodeOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';

const { TextArea } = Input;

type ToolType = 'json' | 'timestamp' | 'base64' | 'url' | 'qrcode' | 'javadecompile';

const toolConfig = {
  json: { name: 'JSON 格式化', icon: CodeOutlined, color: '#1890ff', bgColor: 'bg-blue-100' },
  timestamp: { name: '时间戳转换', icon: ClockCircleOutlined, color: '#52c41a', bgColor: 'bg-green-100' },
  base64: { name: 'Base64 编解码', icon: KeyOutlined, color: '#faad14', bgColor: 'bg-yellow-100' },
  url: { name: 'URL 编解码', icon: LinkOutlined, color: '#f5222d', bgColor: 'bg-red-100' },
  qrcode: { name: '二维码生成', icon: QrcodeOutlined, color: '#722ed1', bgColor: 'bg-purple-100' },
  javadecompile: { name: 'Java 反编译', icon: FileTextOutlined, color: '#f78c65', bgColor: 'bg-orange-100' },
};

export default function Tools() {
  const [activeTool, setActiveTool] = useState<ToolType>('json');

  const [inputJson, setInputJson] = useState<string>('');
  const [outputJson, setOutputJson] = useState<string>('');
  const [jsonCopied, setJsonCopied] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [timestampInput, setTimestampInput] = useState<string>('');
  const [timestampOutput, setTimestampOutput] = useState<string>('');
  const [timestampCopied, setTimestampCopied] = useState<boolean>(false);
  const [timestampError, setTimestampError] = useState<string | null>(null);

  const [base64Input, setBase64Input] = useState<string>('');
  const [base64Output, setBase64Output] = useState<string>('');
  const [base64Copied, setBase64Copied] = useState<boolean>(false);
  const [base64Error, setBase64Error] = useState<string | null>(null);
  const [base64Mode, setBase64Mode] = useState<'encode' | 'decode'>('encode');

  const [urlInput, setUrlInput] = useState<string>('');
  const [urlOutput, setUrlOutput] = useState<string>('');
  const [urlCopied, setUrlCopied] = useState<boolean>(false);
  const [urlMode, setUrlMode] = useState<'encode' | 'decode'>('encode');

  const [qrcodeInput, setQrcodeInput] = useState<string>('');
  const [qrcodeSize, setQrcodeSize] = useState<number>(150);
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');

  const [javaClassContent, setJavaClassContent] = useState<string>('');
  const [javaDecompileOutput, setJavaDecompileOutput] = useState<string>('');
  const [javaDecompileCopied, setJavaDecompileCopied] = useState<boolean>(false);
  const [javaDecompileError, setJavaDecompileError] = useState<string | null>(null);
  const [javaFileName, setJavaFileName] = useState<string>('');

  const handleJsonFormat = useCallback(() => {
    setJsonError(null);
    try {
      if (!inputJson.trim()) {
        throw new Error('请输入JSON内容');
      }
      const parsed = JSON.parse(inputJson);
      const formatted = JSON.stringify(parsed, null, 2);
      setOutputJson(formatted);
    } catch (e: any) {
      setJsonError('JSON格式错误: ' + e.message);
      setOutputJson('');
    }
  }, [inputJson]);

  const handleJsonMinify = useCallback(() => {
    setJsonError(null);
    try {
      if (!inputJson.trim()) {
        throw new Error('请输入JSON内容');
      }
      const parsed = JSON.parse(inputJson);
      const minified = JSON.stringify(parsed);
      setOutputJson(minified);
    } catch (e: any) {
      setJsonError('JSON格式错误: ' + e.message);
      setOutputJson('');
    }
  }, [inputJson]);

  const handleJsonCopy = useCallback(() => {
    if (outputJson) {
      navigator.clipboard.writeText(outputJson);
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    }
  }, [outputJson]);

  const handleJsonClear = useCallback(() => {
    setInputJson('');
    setOutputJson('');
    setJsonCopied(false);
    setJsonError(null);
  }, []);

  const handleTimestampConvert = useCallback(() => {
    setTimestampError(null);
    try {
      if (!timestampInput.trim()) {
        throw new Error('请输入时间戳或日期');
      }
      
      const input = timestampInput.trim();
      let result = '';
      
      if (/^\d{10,13}$/.test(input)) {
        const timestamp = parseInt(input);
        const milliseconds = input.length === 10 ? timestamp * 1000 : timestamp;
        const date = new Date(milliseconds);
        result = `${date.toLocaleString('zh-CN')}\n${date.toISOString()}\n${milliseconds} (毫秒)`;
      } else {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          throw new Error('无效的日期格式');
        }
        result = `${date.getTime()} (毫秒)\n${Math.floor(date.getTime() / 1000)} (秒)\n${date.toISOString()}`;
      }
      
      setTimestampOutput(result);
    } catch (e: any) {
      setTimestampError(e.message);
      setTimestampOutput('');
    }
  }, [timestampInput]);

  const handleTimestampCopy = useCallback(() => {
    if (timestampOutput) {
      navigator.clipboard.writeText(timestampOutput);
      setTimestampCopied(true);
      setTimeout(() => setTimestampCopied(false), 2000);
    }
  }, [timestampOutput]);

  const handleTimestampClear = useCallback(() => {
    setTimestampInput('');
    setTimestampOutput('');
    setTimestampCopied(false);
    setTimestampError(null);
  }, []);

  const handleBase64Convert = useCallback(() => {
    setBase64Error(null);
    try {
      if (!base64Input.trim()) {
        throw new Error('请输入内容');
      }
      
      let result = '';
      if (base64Mode === 'encode') {
        result = btoa(unescape(encodeURIComponent(base64Input)));
      } else {
        result = decodeURIComponent(escape(atob(base64Input)));
      }
      
      setBase64Output(result);
    } catch (e: any) {
      setBase64Error('操作失败: ' + e.message);
      setBase64Output('');
    }
  }, [base64Input, base64Mode]);

  const handleBase64Copy = useCallback(() => {
    if (base64Output) {
      navigator.clipboard.writeText(base64Output);
      setBase64Copied(true);
      setTimeout(() => setBase64Copied(false), 2000);
    }
  }, [base64Output]);

  const handleBase64Clear = useCallback(() => {
    setBase64Input('');
    setBase64Output('');
    setBase64Copied(false);
    setBase64Error(null);
  }, []);

  const handleUrlConvert = useCallback(() => {
    try {
      if (!urlInput.trim()) {
        setUrlOutput('');
        return;
      }
      
      let result = '';
      if (urlMode === 'encode') {
        result = encodeURIComponent(urlInput);
      } else {
        result = decodeURIComponent(urlInput);
      }
      
      setUrlOutput(result);
    } catch (e: any) {
      setUrlOutput('');
    }
  }, [urlInput, urlMode]);

  const handleUrlCopy = useCallback(() => {
    if (urlOutput) {
      navigator.clipboard.writeText(urlOutput);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    }
  }, [urlOutput]);

  const handleUrlClear = useCallback(() => {
    setUrlInput('');
    setUrlOutput('');
    setUrlCopied(false);
  }, []);

  const handleQrcodeGenerate = useCallback(() => {
    if (!qrcodeInput.trim()) return;
    const encodedText = encodeURIComponent(qrcodeInput);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${qrcodeSize}x${qrcodeSize}&data=${encodedText}`;
    setQrcodeUrl(url);
  }, [qrcodeInput, qrcodeSize]);

  const handleQrcodeClear = useCallback(() => {
    setQrcodeInput('');
    setQrcodeUrl('');
  }, []);

  const parseClassFile = useCallback((fileContent: string) => {
    setJavaDecompileError(null);
    try {
      if (!fileContent.trim()) {
        throw new Error('请上传 Class 文件或输入字节码内容');
      }

      const isBase64 = fileContent.startsWith('JVAV') || /^[A-Za-z0-9+/=]+$/.test(fileContent.trim().substring(0, 100));
      
      if (!isBase64) {
        throw new Error('请上传有效的 Class 文件');
      }

      const sampleOutput = `// 反编译结果 - ${javaFileName || 'Unknown.class'}

package com.example;

public class ${javaFileName ? javaFileName.replace('.class', '') : 'Example'} {
    
    // 字段
    private String name;
    private int value;
    
    // 构造函数
    public ${javaFileName ? javaFileName.replace('.class', '') : 'Example'}() {
        this.name = "default";
        this.value = 0;
    }
    
    // 方法
    public String getName() {
        return this.name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public int getValue() {
        return this.value;
    }
    
    public void setValue(int value) {
        this.value = value;
    }
    
    public void printInfo() {
        System.out.println("Name: " + this.name + ", Value: " + this.value);
    }
}

// 注意：这是模拟的反编译结果
// 完整的 Java 反编译需要后端支持`;

      setJavaDecompileOutput(sampleOutput);
      
    } catch (e: any) {
      setJavaDecompileError('解析错误: ' + e.message);
      setJavaDecompileOutput('');
    }
  }, [javaFileName]);

  const handleJavaFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.class')) {
      setJavaDecompileError('请上传 .class 文件');
      return;
    }

    setJavaFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result.startsWith('data:')) {
        const base64Content = result.split(',')[1];
        setJavaClassContent(base64Content);
        parseClassFile(base64Content);
      }
    };
    reader.readAsDataURL(file);
  }, [parseClassFile]);

  const handleJavaDecompileCopy = useCallback(() => {
    if (javaDecompileOutput) {
      navigator.clipboard.writeText(javaDecompileOutput);
      setJavaDecompileCopied(true);
      setTimeout(() => setJavaDecompileCopied(false), 2000);
    }
  }, [javaDecompileOutput]);

  const handleJavaDecompileClear = useCallback(() => {
    setJavaClassContent('');
    setJavaDecompileOutput('');
    setJavaDecompileCopied(false);
    setJavaDecompileError(null);
    setJavaFileName('');
  }, []);

  const renderToolContent = () => {
    const ToolIcon = toolConfig[activeTool].icon;
    
    return (
      <Card className="shadow-sm" style={{ minHeight: '500px' }}>
        <CardContent className="p-6" style={{ minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-12 h-12 ${toolConfig[activeTool].bgColor} rounded-xl flex items-center justify-center`}>
              <ToolIcon style={{ fontSize: '24px', color: toolConfig[activeTool].color }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">{toolConfig[activeTool].name}</h2>
            </div>
          </div>
          <div className="flex-1">

          {activeTool === 'json' && (
            <div className="space-y-6">
              {jsonError && (
                <Alert
                  message="错误"
                  description={jsonError}
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}
              
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输入</label>
                    <TextArea
                      value={inputJson}
                      onChange={(e) => {
                        setInputJson(e.target.value);
                        setJsonError(null);
                      }}
                      placeholder='{"name":"test"}'
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" onClick={handleJsonFormat} style={{ flex: 1 }}>格式化</Button>
                    <Button type="default" onClick={handleJsonMinify} style={{ flex: 1 }}>压缩</Button>
                    <Button type="default" onClick={handleJsonClear} icon={<DeleteOutlined />} />
                  </div>
                </Col>
                
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输出</label>
                    <div className="relative">
                      <TextArea
                        value={outputJson}
                        readOnly
                        placeholder="结果将显示在这里..."
                        rows={8}
                        className="font-mono text-sm bg-gray-50"
                      />
                      {outputJson && (
                        <Button
                          type="text"
                          icon={jsonCopied ? <CheckCircleOutlined /> : <CopyOutlined />}
                          onClick={handleJsonCopy}
                          className="absolute top-2 right-2"
                          style={{ color: jsonCopied ? '#52c41a' : '#666' }}
                        >
                          {jsonCopied ? '已复制' : '复制'}
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {outputJson && (
                    <div className="flex gap-4 text-sm text-gray-500 mt-4">
                      <span>字符: {outputJson.length}</span>
                      <span>行: {outputJson.split('\n').length}</span>
                    </div>
                  )}
                </Col>
              </Row>
            </div>
          )}

          {activeTool === 'timestamp' && (
            <div className="space-y-6">
              {timestampError && (
                <Alert
                  message="错误"
                  description={timestampError}
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}
              
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输入 (时间戳或日期)</label>
                    <Input
                      value={timestampInput}
                      onChange={(e) => setTimestampInput(e.target.value)}
                      placeholder="1609459200000 或 2024-01-01"
                    />
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" onClick={handleTimestampConvert} style={{ flex: 1 }}>转换</Button>
                    <Button type="default" onClick={handleTimestampClear} icon={<DeleteOutlined />} />
                  </div>
                </Col>
                
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输出</label>
                    <div className="relative">
                      <TextArea
                        value={timestampOutput}
                        readOnly
                        placeholder="结果将显示在这里..."
                        rows={4}
                        className="font-mono text-sm bg-gray-50"
                      />
                      {timestampOutput && (
                        <Button
                          type="text"
                          icon={timestampCopied ? <CheckCircleOutlined /> : <CopyOutlined />}
                          onClick={handleTimestampCopy}
                          className="absolute top-2 right-2"
                          style={{ color: timestampCopied ? '#52c41a' : '#666' }}
                        >
                          {timestampCopied ? '已复制' : '复制'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {activeTool === 'base64' && (
            <div className="space-y-6">
              {base64Error && (
                <Alert
                  message="错误"
                  description={base64Error}
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}
              
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Button 
                        type={base64Mode === 'encode' ? 'primary' : 'default'} 
                        onClick={() => setBase64Mode('encode')}
                        size="small"
                      >
                        编码
                      </Button>
                      <Button 
                        type={base64Mode === 'decode' ? 'primary' : 'default'} 
                        onClick={() => setBase64Mode('decode')}
                        size="small"
                      >
                        解码
                      </Button>
                    </div>
                    <TextArea
                      value={base64Input}
                      onChange={(e) => setBase64Input(e.target.value)}
                      placeholder="输入文本或Base64编码"
                      rows={6}
                    />
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" onClick={handleBase64Convert} style={{ flex: 1 }}>执行</Button>
                    <Button type="default" onClick={handleBase64Clear} icon={<DeleteOutlined />} />
                  </div>
                </Col>
                
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输出</label>
                    <div className="relative">
                      <TextArea
                        value={base64Output}
                        readOnly
                        placeholder="结果将显示在这里..."
                        rows={6}
                        className="font-mono text-sm bg-gray-50"
                      />
                      {base64Output && (
                        <Button
                          type="text"
                          icon={base64Copied ? <CheckCircleOutlined /> : <CopyOutlined />}
                          onClick={handleBase64Copy}
                          className="absolute top-2 right-2"
                          style={{ color: base64Copied ? '#52c41a' : '#666' }}
                        >
                          {base64Copied ? '已复制' : '复制'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {activeTool === 'url' && (
            <div className="space-y-6">
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Button 
                        type={urlMode === 'encode' ? 'primary' : 'default'} 
                        onClick={() => setUrlMode('encode')}
                        size="small"
                      >
                        编码
                      </Button>
                      <Button 
                        type={urlMode === 'decode' ? 'primary' : 'default'} 
                        onClick={() => setUrlMode('decode')}
                        size="small"
                      >
                        解码
                      </Button>
                    </div>
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com?name=测试"
                    />
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" onClick={handleUrlConvert} style={{ flex: 1 }}>执行</Button>
                    <Button type="default" onClick={handleUrlClear} icon={<DeleteOutlined />} />
                  </div>
                </Col>
                
                <Col xs={24} lg={12}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输出</label>
                    <div className="relative">
                      <TextArea
                        value={urlOutput}
                        readOnly
                        placeholder="结果将显示在这里..."
                        rows={2}
                        className="font-mono text-sm bg-gray-50"
                      />
                      {urlOutput && (
                        <Button
                          type="text"
                          icon={urlCopied ? <CheckCircleOutlined /> : <CopyOutlined />}
                          onClick={handleUrlCopy}
                          className="absolute top-2 right-2"
                          style={{ color: urlCopied ? '#52c41a' : '#666' }}
                        >
                          {urlCopied ? '已复制' : '复制'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {activeTool === 'qrcode' && (
            <div className="space-y-6">
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">输入内容</label>
                    <TextArea
                      value={qrcodeInput}
                      onChange={(e) => setQrcodeInput(e.target.value)}
                      placeholder="输入网址、文本等内容"
                      rows={6}
                    />
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      二维码大小: {qrcodeSize}px
                    </label>
                    <Input
                      type="range"
                      min="100"
                      max="300"
                      value={qrcodeSize}
                      onChange={(e) => setQrcodeSize(Number(e.target.value))}
                    />
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button type="primary" onClick={handleQrcodeGenerate} style={{ flex: 1 }}>生成二维码</Button>
                    <Button type="default" onClick={handleQrcodeClear} icon={<DeleteOutlined />} />
                  </div>
                </Col>
                
                <Col xs={24} lg={16}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">预览</label>
                    <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-xl">
                      {qrcodeUrl ? (
                        <div className="text-center">
                          <img 
                            src={qrcodeUrl} 
                            alt="二维码" 
                            className="border border-gray-200 rounded-lg mx-auto mb-4"
                          />
                          <a 
                            href={qrcodeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-700 text-sm"
                          >
                            <CopyOutlined /> 点击下载二维码
                          </a>
                        </div>
                      ) : (
                        <div className="text-center">
                          <QrcodeOutlined style={{ fontSize: '64px', color: '#d9d9d9' }} />
                          <p className="text-gray-400 mt-3">二维码预览区域</p>
                          <p className="text-xs text-gray-400">输入内容后点击生成</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {activeTool === 'javadecompile' && (
            <div className="space-y-6" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {javaDecompileError && (
                <Alert
                  message="错误"
                  description={javaDecompileError}
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}
              <Row gutter={[16, 16]} style={{ flex: 1 }}>
                <Col xs={24} lg={10}>
                  <div className="space-y-4 h-full">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">上传 Class 文件</label>
                      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 transition-colors cursor-pointer bg-gray-50"
                        onClick={() => document.getElementById('class-file-input')?.click()}
                      >
                        <UploadOutlined style={{ fontSize: '48px', color: '#9CA3AF', marginBottom: '12px' }} />
                        <div className="text-gray-600 font-medium">点击上传 .class 文件</div>
                        <div className="text-sm text-gray-400 mt-1">支持 Java Class 文件格式</div>
                        {javaFileName && (
                          <div className="mt-3 text-sm text-green-600">✓ {javaFileName}</div>
                        )}
                        <input
                          id="class-file-input"
                          type="file"
                          accept=".class"
                          onChange={handleJavaFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">或输入字节码 (Base64)</label>
                      <TextArea
                        value={javaClassContent}
                        onChange={(e) => setJavaClassContent(e.target.value)}
                        placeholder="粘贴 Class 文件的 Base64 编码内容..."
                        rows={6}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button type="primary" onClick={() => parseClassFile(javaClassContent)} style={{ flex: 1 }} icon={<FileTextOutlined />}>
                        反编译
                      </Button>
                      <Button type="default" onClick={handleJavaDecompileClear} icon={<DeleteOutlined />} />
                    </div>
                  </div>
                </Col>
                
                <Col xs={24} lg={14}>
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">反编译结果</label>
                      <Button
                        type="text"
                        onClick={handleJavaDecompileCopy}
                        icon={javaDecompileCopied ? <CheckCircleOutlined /> : <CopyOutlined />}
                        className={javaDecompileCopied ? 'text-green-500' : ''}
                      >
                        {javaDecompileCopied ? '已复制' : '复制'}
                      </Button>
                    </div>
                    <div className="flex-1 bg-gray-900 rounded-xl p-4 overflow-auto min-h-[300px]">
                      {javaDecompileOutput ? (
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                          {javaDecompileOutput}
                        </pre>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <FileTextOutlined style={{ fontSize: '48px', marginBottom: '12px' }} />
                            <p>反编译结果预览区域</p>
                            <p className="text-xs mt-1">上传 Class 文件后显示结果</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <MainLayout>
      <div className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">实用工具集</h1>
            <p className="text-gray-500">日常开发和工作中常用的工具集合</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {(Object.keys(toolConfig) as ToolType[]).map((tool) => {
              const config = toolConfig[tool];
              const Icon = config.icon;
              const isActive = activeTool === tool;
              
              return (
                <Button
                  key={tool}
                  type={isActive ? 'primary' : 'default'}
                  onClick={() => setActiveTool(tool)}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 transition-all ${
                    isActive ? 'shadow-md' : 'hover:shadow-sm'
                  }`}
                >
                  <Icon style={{ fontSize: '18px' }} />
                  <span>{config.name}</span>
                </Button>
              );
            })}
          </div>

          {renderToolContent()}
        </div>
      </div>
    </MainLayout>
  );
}
