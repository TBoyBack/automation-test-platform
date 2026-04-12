/**
 * Midscene.js 配置文件
 * 配置 AI 模型和其他运行时选项
 */

// 模型配置
export const modelConfig = {
  // 模型 API 地址
  // 使用 OpenAI 官方 API
  baseURL: process.env.MODEL_BASE_URL || 'https://api.openai.com/v1',
  
  // API 密钥
  apiKey: process.env.MODEL_API_KEY,
  
  // 模型名称
  modelName: process.env.MIDSCENE_MODEL_NAME || 'gpt-4o',
  
  // 超时设置（毫秒）
  timeout: 60000,
  
  // 重试次数
  retries: 3,
};

// 视觉模型配置（推荐用于 UI 自动化）
export const visionModelConfig = {
  // 使用视觉语言模型
  modelName: 'gpt-4o',
  
  // 温度参数（0-1，越低越确定性）
  temperature: 0.1,
  
  // 最大 token 数
  maxTokens: 4096,
};

// Midscene 报告配置
export const reportConfig = {
  // 报告输出目录
  outputDir: './midscene_run/report',
  
  // 报告类型: 'merged' | 'separate'
  reportType: 'merged',
  
  // 是否启用深色模式
  darkMode: false,
  
  // 是否显示 Token 消耗
  showTokenUsage: true,
};

// 执行配置
export const executionConfig = {
  // 全局超时（毫秒）
  globalTimeout: 120000,
  
  // 单步操作超时
  actionTimeout: 30000,
  
  // 页面导航超时
  navigationTimeout: 60000,
  
  // 断言超时
  assertionTimeout: 20000,
  
  // 截图质量
  screenshotQuality: 80,
};

// 浏览器配置
export const browserConfig = {
  // 视口大小
  viewport: {
    desktop: { width: 1280, height: 720 },
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
  },
  
  // 是否无头模式
  headless: process.env.NODE_ENV === 'production',
  
  // 用户代理
  userAgent: {
    mobile: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

// 设备配置
export const deviceConfig = {
  android: {
    platformName: 'Android',
    automationName: 'UiAutomator2',
    // WebView 配置
    chromeOptions: {
      androidPackage: 'com.android.chrome',
      androidUseRunningApp: true,
    },
  },
  
  ios: {
    platformName: 'iOS',
    automationName: 'XCUITest',
    safariInitialUrl: 'https://www.apple.com',
  },
};

// 缓存配置
export const cacheConfig = {
  // 是否启用缓存
  enabled: true,
  
  // 缓存有效期（秒）
  ttl: 3600,
  
  // 缓存大小限制（MB）
  maxSize: 100,
};
