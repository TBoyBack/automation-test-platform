/**
 * Midscene.js Web 端测试示例
 * 使用自然语言编写测试用例
 */

import { test as baseTest, expect } from '@playwright/test';
import { MidsceneFixtures } from '@midscene/web/playwright-test';
import 'dotenv/config';

// 扩展 Playwright Test，注入 Midscene 能力
export const midsceneTest = baseTest.extend<MidsceneFixtures>({
  ...MidsceneFixtures,
});

// ============ 测试用例 1: 电商搜索流程 ============

midsceneTest('电商网站 - 搜索并筛选商品', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 1. 打开电商网站
  await page.goto('https://www.saucedemo.com');
  
  // 2. 使用 AI 登录
  await agent.aiInput('用户名输入框', { value: 'standard_user' });
  await agent.aiInput('密码输入框', { value: 'secret_sauce' });
  await agent.aiTap('登录按钮');
  
  // 3. 断言登录成功
  await agent.aiAssert('已成功登录，显示商品列表页面');
  
  // 4. 添加商品到购物车
  await agent.aiTap('添加到购物车按钮（第一个商品）');
  
  // 5. 断言购物车更新
  await agent.aiAssert('购物车图标显示数量为1');
  
  // 6. 查看购物车
  await agent.aiTap('购物车图标');
  
  // 7. 断言购物车页面
  await agent.aiAssert('购物车页面显示已添加的商品');
  
  // 8. 点击结算
  await agent.aiTap('结算按钮');
  
  // 9. 填写信息
  await agent.aiInput('姓输入框', { value: 'Test' });
  await agent.aiInput('名输入框', { value: 'User' });
  await agent.aiInput('邮编输入框', { value: '12345' });
  
  // 10. 继续
  await agent.aiTap('继续按钮');
  
  // 11. 断言订单概览
  await agent.aiAssert('订单概览页面显示商品总价');
  
  // 12. 完成订单
  await agent.aiTap('完成订单按钮');
  
  // 13. 断言订单完成
  await agent.aiAssert('显示订单完成页面');
});

// ============ 测试用例 2: 社交媒体发帖流程 ============

midsceneTest('社交媒体 - 发布图文帖子', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 1. 使用本地页面模拟社交媒体发帖，避免对真实站点产生副作用
  await page.setContent(`
    <main>
      <h1>测试社交动态</h1>
      <button type="button" aria-label="发帖/编写新帖子按钮">新建帖子</button>
      <label>
        帖子输入框
        <textarea aria-label="帖子输入框"></textarea>
      </label>
      <button type="button" aria-label="预览按钮" onclick="
        document.querySelector('#timeline').textContent =
          document.querySelector('textarea').value;
        document.querySelector('#notice').textContent = '帖子预览成功';
      ">预览</button>
      <p id="notice" role="status"></p>
      <section id="timeline" aria-label="本地时间线"></section>
    </main>
  `);
  
  // 2. 点击发帖按钮
  await agent.aiTap('发帖/编写新帖子按钮');
  
  // 3. 输入帖子内容
  await agent.aiInput('帖子输入框', { 
    value: '这是一条仅在本地页面预览的自动化测试内容'
  });
  
  // 4. 断言内容输入
  await agent.aiAssert('帖子输入框显示刚输入的内容');
  
  // 5. 点击预览
  await agent.aiTap('预览按钮');
  
  // 6. 等待预览成功
  await agent.aiWaitFor('帖子预览成功的提示');
  
  // 7. 断言内容只显示在本地页面中
  await agent.aiAssert('本地时间线中显示新预览内容');
});

// ============ 测试用例 3: 表单填写与验证 ============

midsceneTest('表单网站 - 用户注册流程', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 1. 打开注册页面
  await page.goto('https://practice.expandtesting.com/register');
  
  // 2. 填写基本信息
  await agent.aiInput('用户名输入框', { value: 'testuser123' });
  await agent.aiInput('邮箱输入框', { value: 'testuser123@example.com' });
  await agent.aiInput('密码输入框', { value: 'SecurePass123!' });
  
  // 3. 确认密码
  await agent.aiInput('确认密码输入框', { value: 'SecurePass123!' });
  
  // 4. 点击注册
  await agent.aiTap('注册按钮');
  
  // 5. 等待跳转
  await agent.aiWaitFor('注册成功或跳转到登录页面');
  
  // 6. 断言结果
  await agent.aiAssert('页面显示注册成功提示或自动登录');
});

// ============ 测试用例 4: 数据查询 ============

midsceneTest('数据网站 - 查询并验证结果', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 1. 打开数据网站
  await page.goto('https://www.weather.com');
  
  // 2. 输入城市
  await agent.aiInput('城市搜索框', { value: 'Beijing' });
  await agent.aiTap('搜索按钮');
  
  // 3. 等待结果
  await agent.aiWaitFor('天气信息加载完成');
  
  // 4. 查询天气数据
  const weatherData = await agent.aiQuery(
    '{ temperature: string, condition: string, humidity: string }',
    '当前天气温度、天气状况和湿度'
  );
  
  console.log('查询到的天气数据:', weatherData);
  
  // 5. 断言数据有效性
  await agent.aiAssert(`页面显示北京当前天气信息`);
});

// ============ 测试用例 5: 复杂操作序列 ============

midsceneTest('复杂场景 - 多步骤导航与操作', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 使用 aiAction 合并多步操作（节省 Token）
  await page.goto('https://www.example.com');
  
  // 一次性完成多个操作
  await agent.aiAction(
    '在顶部导航栏找到"产品"菜单项并点击，' +
    '在展开的子菜单中找到"企业解决方案"并点击，' +
    '在产品介绍页面中找到"立即试用"按钮并点击'
  );
  
  // 断言进入试用页面
  await agent.aiAssert('当前页面是试用申请表单页面');
  
  // 填写表单
  await agent.aiAction(
    '在邮箱输入框填入 test@company.com，' +
    '在公司名称输入框填入 Test Company，' +
    '在提交按钮上点击'
  );
  
  // 断言提交成功
  await agent.aiAssert('显示表单提交成功或确认提示');
});

// ============ 测试用例 6: 错误场景验证 ============

midsceneTest('错误场景 - 表单验证', async ({ page }) => {
  const agent = new (await import('@midscene/web/playwright')).PlaywrightAgent(page);

  // 1. 打开表单页面
  await page.goto('https://www.saucedemo.com/checkout-step-one.html');
  
  // 2. 不填写信息直接提交
  await agent.aiTap('继续按钮');
  
  // 3. 断言出现错误提示
  await agent.aiAssert('页面显示错误提示信息，提示必填字段');
  
  // 4. 填写错误格式的信息
  await agent.aiInput('姓输入框', { value: 'Test' });
  await agent.aiInput('名输入框', { value: 'User' });
  await agent.aiInput('邮编输入框', { value: 'ABC' });  // 错误格式
  
  // 5. 提交
  await agent.aiTap('继续按钮');
  
  // 6. 断言格式错误提示
  await agent.aiAssert('页面显示邮编格式错误提示');
});
