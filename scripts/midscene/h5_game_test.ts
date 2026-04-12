/**
 * Midscene.js H5 游戏测试示例
 * 使用 AI 视觉定位，无需关心 DOM 结构
 */

import { PlaywrightAgent } from '@midscene/web/playwright';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import 'dotenv/config';

interface TestConfig {
  url: string;
  viewport?: { width: number; height: number };
  headless?: boolean;
  timeout?: number;
}

interface TestStep {
  action: 'navigate' | 'aiTap' | 'aiInput' | 'aiAssert' | 'aiQuery' | 'aiWaitFor' | 'screenshot';
  prompt?: string;
  value?: string;
  schema?: string;
  url?: string;
  path?: string;
}

/**
 * Midscene H5 游戏测试基类
 */
class MidsceneGameTest {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected agent: PlaywrightAgent | null = null;
  protected config: TestConfig;

  constructor(config: TestConfig) {
    this.config = {
      viewport: { width: 375, height: 667 },
      headless: false,
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 初始化测试环境
   */
  async setup(): Promise<void> {
    console.log('🚀 初始化浏览器...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    this.page = await this.context.newPage();
    
    // 初始化 Midscene Agent
    this.agent = new PlaywrightAgent(this.page);
    
    console.log('✅ 浏览器初始化完成');
  }

  /**
   * 执行测试步骤
   */
  async executeStep(step: TestStep): Promise<any> {
    if (!this.agent || !this.page) {
      throw new Error('测试环境未初始化');
    }

    const { action, prompt, value, schema, url, path } = step;

    try {
      switch (action) {
        case 'navigate':
          await this.page.goto(url!, { waitUntil: 'networkidle' });
          await this.agent.recordToReport(`导航到 ${url}`);
          return { status: 'success', message: `已导航到 ${url}` };

        case 'aiTap':
          await this.agent.aiTap(prompt!);
          await this.agent.recordToReport(`点击: ${prompt}`);
          return { status: 'success', message: `已点击: ${prompt}` };

        case 'aiInput':
          await this.agent.aiInput(prompt!, { value: value! });
          await this.agent.recordToReport(`输入: ${value} 到 ${prompt}`);
          return { status: 'success', message: `已在 ${prompt} 输入 ${value}` };

        case 'aiAssert':
          await this.agent.aiAssert(prompt!);
          await this.agent.recordToReport(`断言: ${prompt}`);
          return { status: 'success', message: `断言通过: ${prompt}` };

        case 'aiQuery':
          const result = await this.agent.aiQuery(schema!, prompt!);
          await this.agent.recordToReport(`查询: ${prompt}`);
          return { status: 'success', data: result };

        case 'aiWaitFor':
          await this.agent.aiWaitFor(prompt!);
          await this.agent.recordToReport(`等待: ${prompt}`);
          return { status: 'success', message: `已等待: ${prompt}` };

        case 'screenshot':
          await this.page.screenshot({ path: path! });
          return { status: 'success', message: `截图已保存: ${path}` };

        default:
          throw new Error(`未知操作: ${action}`);
      }
    } catch (error: any) {
      console.error(`❌ 步骤执行失败: ${error.message}`);
      await this.page?.screenshot({ path: `error_${Date.now()}.png` });
      throw error;
    }
  }

  /**
   * 执行测试场景
   */
  async runTest(steps: TestStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`📍 步骤 ${i + 1}: ${step.action}`);
      await this.executeStep(step);
    }
  }

  /**
   * 清理环境
   */
  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log('🔌 浏览器已关闭');
    }
  }
}

/**
 * H5 小游戏测试示例
 */
class H5GameTest extends MidsceneGameTest {
  constructor() {
    super({
      url: 'https://your-game.example.com',
      viewport: { width: 375, height: 667 },
      headless: false,
    });
  }

  /**
   * 游戏主流程测试
   */
  async testGameFlow(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('测试场景: H5 小游戏主流程');
    console.log('='.repeat(50) + '\n');

    const steps: TestStep[] = [
      // 1. 打开游戏
      {
        action: 'navigate',
        url: 'https://your-game.example.com',
      },
      // 2. 等待游戏加载
      {
        action: 'aiWaitFor',
        prompt: '游戏加载完成，出现开始按钮或加载进度条消失',
      },
      // 3. 截图记录初始状态
      {
        action: 'screenshot',
        path: './screenshots/game_loaded.png',
      },
      // 4. 点击开始游戏
      {
        action: 'aiTap',
        prompt: '开始游戏按钮',
      },
      // 5. 等待进入游戏
      {
        action: 'aiWaitFor',
        prompt: '游戏主界面已加载，显示游戏画面',
      },
      // 6. 断言游戏已启动
      {
        action: 'aiAssert',
        prompt: '游戏已进入主界面，显示分数或生命值',
      },
      // 7. 执行游戏操作 - 点击暂停
      {
        action: 'aiTap',
        prompt: '暂停按钮',
      },
      // 8. 等待暂停菜单
      {
        action: 'aiWaitFor',
        prompt: '暂停菜单出现',
      },
      // 9. 断言暂停菜单
      {
        action: 'aiAssert',
        prompt: '暂停菜单显示，包含继续和重新开始选项',
      },
      // 10. 点击继续
      {
        action: 'aiTap',
        prompt: '继续游戏按钮',
      },
      // 11. 最终截图
      {
        action: 'screenshot',
        path: './screenshots/game_continued.png',
      },
    ];

    await this.runTest(steps);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ 游戏流程测试通过!');
    console.log('='.repeat(50));
  }
}

/**
 * H5 电商页面测试示例
 */
class H5ShoppingTest extends MidsceneGameTest {
  constructor() {
    super({
      url: 'https://m.example.com',
      viewport: { width: 375, height: 667 },
      headless: false,
    });
  }

  /**
   * 购物流程测试
   */
  async testShoppingFlow(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('测试场景: H5 购物完整流程');
    console.log('='.repeat(50) + '\n');

    const steps: TestStep[] = [
      // 1. 打开商城
      {
        action: 'navigate',
        url: 'https://m.example.com',
      },
      // 2. 搜索商品
      {
        action: 'aiInput',
        prompt: '顶部搜索框',
        value: '无线耳机',
      },
      {
        action: 'aiTap',
        prompt: '搜索按钮',
      },
      // 3. 等待搜索结果
      {
        action: 'aiWaitFor',
        prompt: '搜索结果列表已加载',
      },
      // 4. 断言搜索结果
      {
        action: 'aiAssert',
        prompt: '搜索结果页面显示了无线耳机相关商品',
      },
      // 5. 点击商品
      {
        action: 'aiTap',
        prompt: '第一个商品卡片',
      },
      // 6. 等待商品详情
      {
        action: 'aiWaitFor',
        prompt: '商品详情页已加载',
      },
      // 7. 断言商品详情
      {
        action: 'aiAssert',
        prompt: '商品详情页显示价格和加入购物车按钮',
      },
      // 8. 加入购物车
      {
        action: 'aiTap',
        prompt: '加入购物车按钮',
      },
      // 9. 断言加入成功
      {
        action: 'aiAssert',
        prompt: '出现成功加入购物车的提示',
      },
    ];

    await this.runTest(steps);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ 购物流程测试通过!');
    console.log('='.repeat(50));
  }
}

// ============ 执行测试 ============

async function main() {
  // 方式一：H5 游戏测试
  const gameTest = new H5GameTest();
  
  // 方式二：H5 购物测试
  // const shopTest = new H5ShoppingTest();

  try {
    await gameTest.setup();
    await gameTest.testGameFlow();
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await gameTest.teardown();
  }
}

main();
