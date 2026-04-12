# 自动化测试平台

> 一站式移动端 & Web 自动化测试平台

## 📋 项目简介

本项目为创业公司测试团队打造的自动化测试能力建设平台，支持：

- **Android 混合 APP**：Native + WebView 自动化测试
- **H5 Web 应用**：游戏、网页自动化测试
- **视频回放**：测试过程全程录像

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Web 管理平台                            │
│  (用例管理 | 执行调度 | 结果展示 | 设备管理 | 脚本编辑)      │
├─────────────────────────────────────────────────────────────┤
│                     RESTful API                            │
├─────────────────────────────────────────────────────────────┤
│     Appium2 Engine      │      Midscene.js Engine          │
│  (Android Native/WebView)│      (H5/Web/AI Vision)         │
├─────────────────────────────────────────────────────────────┤
│     执行节点集群        │      设备池                       │
│  (Node.js Worker)       │  (Android真机/模拟器/浏览器)      │
└─────────────────────────────────────────────────────────────┘
```

## ✨ 核心特性

- 🤖 **AI 驱动**：集成 Midscene.js，支持自然语言编写测试用例
- 📱 **跨平台**：支持 Android Native、WebView、H5 游戏
- 🎥 **视频回放**：FFmpeg 录屏，完整复现测试过程
- ⚡ **高效执行**：分布式任务调度，支持并发执行
- 📊 **可视化报告**：Allure 报告 + 自定义 HTML 报告

## 🛠️ 技术栈

| 模块 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Ant Design |
| **后端** | Node.js + Express / FastAPI |
| **数据库** | PostgreSQL + Redis |
| **移动端框架** | Appium2 + UIAutomator2 |
| **AI 测试** | Midscene.js + Playwright |
| **视频处理** | FFmpeg |

## 📁 项目结构

```
automation-test-platform/
├── docs/                    # 架构设计文档
├── src/
│   ├── api/                # 后端 API
│   │   ├── routes/         # 路由定义
│   │   ├── controllers/    # 控制器
│   │   └── services/       # 业务逻辑
│   ├── engine/              # 测试执行引擎
│   │   ├── appium/         # Appium2 引擎
│   │   └── midscene/       # Midscene.js 引擎
│   ├── web/                 # Web 前端
│   │   ├── components/     # React 组件
│   │   ├── pages/          # 页面
│   │   └── services/       # API 调用
│   └── shared/             # 共享模块
├── scripts/                 # 示例脚本
│   ├── appium/             # Appium 示例
│   └── midscene/           # Midscene 示例
├── tests/                   # 测试用例
├── docker/                  # Docker 配置
├── package.json
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18.x
- Python >= 3.10
- PostgreSQL >= 15
- Redis >= 7
- Android SDK
- FFmpeg

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-org/automation-test-platform.git
cd automation-test-platform

# 安装后端依赖
npm install

# 安装前端依赖
cd src/web && npm install

# 安装 Python 依赖（可选）
pip install -r requirements.txt
```

### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
DATABASE_URL=postgresql://user:password@localhost:5432/test_platform
REDIS_URL=redis://localhost:6379
APPIUM_HOST=http://localhost:4723
```

### 启动服务

```bash
# 启动后端服务
npm run dev:server

# 启动前端服务（新终端）
npm run dev:web

# 或使用 Docker 启动全部服务
docker-compose up -d
```

## 📝 示例脚本

### Appium2 - Android Native + WebView

```python
# scripts/appium/hybrid_app_test.py
from appium import webdriver
from appium.options.android import UiAutomator2Options

class HybridAppTest:
    def __init__(self, device_config):
        self.capabilities = UiAutomator2Options()
        self.capabilities.platform_name = "Android"
        self.capabilities.device_name = device_config['name']
        self.capabilities.udid = device_config['udid']
        self.capabilities.app_package = "com.example.app"
        self.driver = None
    
    def setup(self):
        self.driver = webdriver.Remote(
            "http://localhost:4723",
            options=self.capabilities
        )
    
    def test_native_flow(self):
        """测试 Native 页面"""
        # Native 层操作
        self.driver.find_element("id", "com.example.app:id/btn_login").click()
        self.driver.find_element("id", "com.example.app:id/input_username").send_keys("test")
    
    def test_webview_flow(self):
        """测试 WebView 页面"""
        # 切换到 WebView
        contexts = self.driver.contexts
        for ctx in contexts:
            if ctx.startswith('WEBVIEW'):
                self.driver.switch_to.context(ctx)
                break
        
        # WebView 内操作
        self.driver.find_element("css selector", ".login-form input").send_keys("test")
        self.driver.find_element("css selector", ".login-form button").click()
        
        # 切回 Native
        self.driver.switch_to.context('NATIVE_APP')
    
    def teardown(self):
        if self.driver:
            self.driver.quit()

if __name__ == "__main__":
    test = HybridAppTest({"name": "Pixel 6", "udid": "emulator-5554"})
    test.setup()
    try:
        test.test_native_flow()
        test.test_webview_flow()
    finally:
        test.teardown()
```

### Midscene.js - H5 游戏测试

```javascript
// scripts/midscene/h5_game_test.js
import { PlaywrightAgent } from '@midscene/web/playwright';
import { chromium } from 'playwright';
import 'dotenv/config';

async function testH5Game() {
  // 启动浏览器
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }  // 移动端视口
  });
  const page = await context.newPage();
  
  // 初始化 Midscene Agent
  const agent = new PlaywrightAgent(page);
  
  try {
    // 打开游戏页面
    await page.goto('https://your-game.example.com');
    
    // 等待加载
    await agent.aiWaitFor('游戏加载完成，出现开始按钮');
    
    // 点击开始按钮
    await agent.aiTap('开始游戏按钮');
    
    // AI 视觉断言
    await agent.aiAssert('游戏已进入主界面');
    
    // 记录截图到报告
    await agent.recordToReport('游戏主界面验证');
    
    console.log('H5游戏测试通过！');
  } catch (error) {
    console.error('测试失败:', error);
    await page.screenshot({ path: 'error_screenshot.png' });
  } finally {
    await browser.close();
  }
}

testH5Game();
```

### Midscene.js - Web 端测试

```typescript
// scripts/midscene/web_test.spec.ts
import { test, expect } from '@playwright/test';
import { MidsceneFixtures } from '@midscene/web/playwright-test';
import 'dotenv/config';

// 扩展 Playwright Test
export const midsceneTest = test.extend<MidsceneFixtures>({
  ...MidsceneFixtures,
});

midsceneTest('电商搜索流程测试', async ({ page }) => {
  const agent = new PlaywrightAgent(page);
  
  // 1. 打开网站
  await page.goto('https://www.example.com');
  
  // 2. 搜索商品（AI 视觉定位）
  await agent.aiInput('顶部搜索框', { value: '笔记本电脑' });
  await agent.aiTap('搜索按钮');
  
  // 3. 筛选商品
  await agent.aiTap('销量最高筛选项');
  
  // 4. 断言结果
  await agent.aiAssert('搜索结果页面显示了笔记本电脑商品列表');
  
  // 5. 点击商品
  await agent.aiTap('第一个商品卡片');
  
  // 6. 验证商品详情页
  await agent.aiAssert('商品详情页正常显示价格和库存');
  
  // 7. 加入购物车
  await agent.aiTap('加入购物车按钮');
  await agent.aiAssert('成功加入购物车的提示');
});
```

## 📊 视频录制使用

```python
# scripts/recording_example.py
from screen_recorder import ScreenRecorder

# 创建录屏实例
recorder = ScreenRecorder(
    device_udid="emulator-5554",
    output_dir="./reports/videos"
)

# 开始录屏
recorder.start_recording(max_time=600, fps=15)

# ... 执行测试步骤 ...

# 停止录屏
video_path = recorder.stop_recording()

print(f"录屏已保存: {video_path}")
```

## 🔧 开发指南

### 添加新的测试用例

1. 在 `tests/` 目录下创建用例文件
2. 继承对应的测试引擎
3. 实现测试方法
4. 在 Web 平台上传用例

### 添加新设备

1. 连接设备到执行机
2. 配置 ADB 连接
3. 在 Web 平台设备管理中添加设备
4. 验证设备在线状态

### 自定义报告

参考 `docs/report_template.md` 文档。

## 📚 相关文档

- [架构设计](./docs/architecture.md)
- [API 接口文档](./docs/api.md)
- [设备接入指南](./docs/device_setup.md)
- [常见问题FAQ](./docs/faq.md)

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 License

MIT License

## 📞 联系方式

- Issue: [GitHub Issues](https://github.com/your-org/automation-test-platform/issues)
- Email: test-team@your-company.com
