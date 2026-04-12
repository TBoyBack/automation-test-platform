"""
Android 混合 APP 测试示例
支持 Native + WebView 混合测试
"""

from appium import webdriver
from appium.options.android import UiAutomator2Options
from appium.webdriver.common.appiumby import AppiumBy
import time
import json
from typing import Optional, Dict, List, Any


class HybridAppTest:
    """混合 APP 测试基类"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化测试
        
        Args:
            config: 设备配置
                - platform_version: Android 版本
                - device_name: 设备名称
                - udid: 设备 UDID
                - app_package: APP 包名
                - app_activity: 启动 Activity
        """
        self.config = config
        self.driver: Optional[webdriver.Remote] = None
        self.current_context = 'NATIVE_APP'
        
    def setup(self):
        """建立 Appium 连接"""
        capabilities = UiAutomator2Options()
        capabilities.platform_name = "Android"
        capabilities.platform_version = self.config.get('platform_version', '11')
        capabilities.device_name = self.config.get('device_name', 'Android Device')
        capabilities.udid = self.config.get('udid')
        capabilities.app_package = self.config.get('app_package')
        capabilities.app_activity = self.config.get('app_activity')
        capabilities.no_reset = True
        capabilities.enablePerformanceLogging = True
        
        # WebView 设置
        capabilities.set_capability("chromeOptions", {
            "androidPackage": self.config.get('app_package'),
            "androidUseRunningApp": True
        })
        
        self.driver = webdriver.Remote(
            "http://localhost:4723",
            options=capabilities
        )
        print(f"✅ 已连接到设备: {self.config.get('device_name')}")
        
    def switch_to_webview(self) -> str:
        """
        切换到 WebView 上下文
        
        Returns:
            WebView context ID
        """
        if not self.driver:
            raise Exception("驱动未初始化")
            
        contexts = self.driver.contexts
        print(f"📋 可用上下文: {contexts}")
        
        # 查找 WebView
        webview_context = None
        for ctx in contexts:
            if ctx.startswith('WEBVIEW'):
                webview_context = ctx
                break
                
        if webview_context:
            self.driver.switch_to.context(webview_context)
            self.current_context = webview_context
            print(f"✅ 已切换到 WebView: {webview_context}")
            return webview_context
        else:
            raise Exception("未找到 WebView 上下文")
    
    def switch_to_native(self):
        """切换回 Native 上下文"""
        if not self.driver:
            raise Exception("驱动未初始化")
            
        self.driver.switch_to.context('NATIVE_APP')
        self.current_context = 'NATIVE_APP'
        print("✅ 已切换到 Native")
    
    def get_all_contexts(self) -> List[str]:
        """获取所有上下文"""
        if not self.driver:
            return []
        return self.driver.contexts
    
    # ============ Native 操作封装 ============
    
    def native_click(self, by: str, value: str, timeout: int = 10):
        """Native 点击"""
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        element = WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((by, value))
        )
        element.click()
        time.sleep(0.5)
        
    def native_input(self, by: str, value: str, text: str, clear_first: bool = True):
        """Native 输入"""
        element = self.driver.find_element(by, value)
        if clear_first:
            element.clear()
        element.send_keys(text)
        
    def native_screenshot(self, path: str):
        """截图"""
        self.driver.save_screenshot(path)
        
    # ============ WebView 操作封装 ============
    
    def webview_click(self, selector: str, selector_type: str = 'css'):
        """WebView 点击
        
        Args:
            selector: 选择器
            selector_type: css / xpath / id
        """
        if selector_type == 'css':
            self.driver.find_element(AppiumBy.CSS_SELECTOR, selector).click()
        elif selector_type == 'xpath':
            self.driver.find_element(AppiumBy.XPATH, selector).click()
        elif selector_type == 'id':
            self.driver.find_element(AppiumBy.ID, selector).click()
        time.sleep(0.5)
        
    def webview_input(self, selector: str, text: str, selector_type: str = 'css'):
        """WebView 输入"""
        if selector_type == 'css':
            element = self.driver.find_element(AppiumBy.CSS_SELECTOR, selector)
        elif selector_type == 'xpath':
            element = self.driver.find_element(AppiumBy.XPATH, selector)
        elif selector_type == 'id':
            element = self.driver.find_element(AppiumBy.ID, selector)
        element.clear()
        element.send_keys(text)
        
    def webview_execute_script(self, script: str):
        """执行 JavaScript"""
        return self.driver.execute_script(script)
    
    def teardown(self):
        """断开连接"""
        if self.driver:
            self.driver.quit()
            print("🔌 已断开连接")


class ExampleHybridTest(HybridAppTest):
    """混合 APP 测试示例"""
    
    def test_native_to_webview_flow(self):
        """
        测试场景：Native 登录 -> 进入 WebView 活动页 -> WebView 操作 -> 返回 Native
        """
        print("\n" + "="*50)
        print("测试场景：Native 到 WebView 完整流程")
        print("="*50)
        
        # Step 1: Native 登录
        print("\n📍 Step 1: Native 登录")
        try:
            self.native_click(AppiumBy.ID, "com.example.app:id/btn_login")
            self.native_input(AppiumBy.ID, "com.example.app:id/input_username", "test_user")
            self.native_input(AppiumBy.ID, "com.example.app:id/input_password", "password123")
            self.native_click(AppiumBy.ID, "com.example.app:id/btn_submit")
            self.native_screenshot("step1_login.png")
            print("✅ 登录成功")
        except Exception as e:
            print(f"❌ 登录失败: {e}")
            self.native_screenshot("error_login.png")
            raise
            
        # 等待页面跳转
        time.sleep(2)
        
        # Step 2: 进入活动页面（包含 WebView）
        print("\n📍 Step 2: 进入活动页面")
        try:
            self.native_click(AppiumBy.ID, "com.example.app:id/btn_promo")
            time.sleep(3)  # 等待 WebView 加载
            self.native_screenshot("step2_promo.png")
            print("✅ 已进入活动页面")
        except Exception as e:
            print(f"❌ 进入活动页失败: {e}")
            raise
            
        # Step 3: 切换到 WebView
        print("\n📍 Step 3: 切换到 WebView")
        self.switch_to_webview()
        
        # Step 4: WebView 内操作
        print("\n📍 Step 4: WebView 内操作")
        try:
            # 填写表单
            self.webview_input("input[name='name']", "张三", "css")
            self.webview_input("input[name='phone']", "13800138000", "css")
            self.webview_click(".btn-submit", "css")
            self.native_screenshot = lambda p: self.driver.save_screenshot(p)
            self.driver.save_screenshot("step4_webview_form.png")
            print("✅ WebView 表单提交成功")
            
            # 等待结果
            time.sleep(2)
            self.driver.save_screenshot("step4_webview_result.png")
            
        except Exception as e:
            print(f"❌ WebView 操作失败: {e}")
            self.driver.save_screenshot("error_webview.png")
            raise
            
        # Step 5: 切回 Native 完成后续操作
        print("\n📍 Step 5: 切回 Native")
        self.switch_to_native()
        
        try:
            # 验证 WebView 操作结果
            result_text = self.driver.find_element(
                AppiumBy.ID, "com.example.app:id/text_result"
            ).text
            print(f"📋 WebView 返回结果: {result_text}")
            
            # 点击确认
            self.native_click(AppiumBy.ID, "com.example.app:id/btn_confirm")
            self.native_screenshot("step5_complete.png")
            print("✅ 完整流程测试通过")
            
        except Exception as e:
            print(f"❌ Native 验证失败: {e}")
            raise
            
        print("\n" + "="*50)
        print("测试完成!")
        print("="*50)


if __name__ == "__main__":
    # 测试配置
    config = {
        'platform_version': '11',
        'device_name': 'Pixel 6',
        'udid': 'emulator-5554',
        'app_package': 'com.example.hybridapp',
        'app_activity': '.MainActivity'
    }
    
    # 执行测试
    test = ExampleHybridTest(config)
    
    try:
        test.setup()
        test.test_native_to_webview_flow()
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
    finally:
        test.teardown()
