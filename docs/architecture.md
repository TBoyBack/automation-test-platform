# 架构设计文档

> 自动化测试平台 - 系统架构设计

## 1. 系统架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         自动化测试平台架构                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        接入层 (Gateway)                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │   │
│  │  │用户前端 │  │API接入  │  │Webhook  │  │CLI工具  │  │SDK接入  │       │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                         服务层 (Services)                             │   │
│  │                                                                       │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │   任务调度     │  │   设备管理     │  │   报告生成     │              │   │
│  │  │  Task Queue   │  │ Device Pool   │  │ Report Gen   │              │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘              │   │
│  │                                                                       │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │   │
│  │  │   用例管理     │  │   用户认证     │  │   通知服务     │              │   │
│  │  │  Case Mgmt    │  │    Auth       │  │ Notification  │              │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘              │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                        执行层 (Execution Layer)                        │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │   │
│  │  │       Appium2 Engine        │  │      Midscene.js Engine     │      │   │
│  │  │  ┌─────────────────────┐   │  │  ┌─────────────────────┐   │      │   │
│  │  │  │  UIAutomator2 Driver │   │  │  │  Playwright Agent   │   │      │   │
│  │  │  │  Chromedriver        │   │  │  │  AI Vision Model    │   │      │   │
│  │  │  │  ADB Bridge          │   │  │  │  (Qwen-VL/Doubao)   │   │      │   │
│  │  │  └─────────────────────┘   │  │  └─────────────────────┘   │      │   │
│  │  └─────────────────────────────┘  └─────────────────────────────┘      │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │   │
│  │  │       Airtest Engine        │  │        录像服务              │      │   │
│  │  │  (H5游戏图像识别)           │  │    (FFmpeg录制)              │      │   │
│  │  └─────────────────────────────┘  └─────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                        设备层 (Device Layer)                           │   │
│  │                                                                       │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │   │
│  │  │ Android   │  │ Android   │  │ 浏览器集群 │  │  云设备    │       │   │
│  │  │ 真机群     │  │ 模拟器群   │  │           │  │           │       │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘       │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心模块设计

### 2.1 任务调度模块

```
┌─────────────────────────────────────────────────────────────┐
│                    任务调度流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户提交任务                                                │
│      │                                                       │
│      ▼                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  任务入队   │───▶│  任务分派   │───▶│  执行引擎   │     │
│  │ (Redis)    │    │ (负载均衡)  │    │ (Worker)    │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                │             │
│      ┌─────────────────────────────────────────┘             │
│      │                                                       │
│      ▼                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  结果存储   │◀───│  执行监控   │◀───│  设备分配   │     │
│  │ (PostgreSQL)│    │ (实时推送)  │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 执行引擎选择策略

| 测试场景 | 推荐引擎 | 定位策略 |
|---------|---------|---------|
| Android Native | Appium2 + UIAutomator2 | resource-id → XPath → 坐标 |
| Android WebView | Appium2 + Chromedriver | CSS Selector → XPath |
| H5 游戏 | Airtest + 图像识别 | 模板匹配 → OCR |
| H5 Web 应用 | Midscene.js + Playwright | AI 视觉定位 |
| 复杂 Web 场景 | Midscene.js (AI) | 自然语言 → 视觉定位 |

### 2.3 混合 APP 测试流程

```python
# 混合 APP 测试流程示例
class HybridAppTest:
    def test_complete_flow(self):
        # Step 1: Native 登录
        self.native_login()
        
        # Step 2: 进入 WebView 活动页
        self.driver.find_element("id", "btn_promo").click()
        self.wait_for_webview()
        
        # Step 3: 切换到 WebView
        self.switch_to_webview()
        
        # Step 4: WebView 内操作
        self.webview_interaction()
        
        # Step 5: 切回 Native 完成支付
        self.switch_to_native()
        self.complete_payment()
        
        # Step 6: 验证结果
        self.verify_native_result()
```

## 3. 数据流设计

### 3.1 测试执行数据流

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户    │────▶│  前端    │────▶│  API    │────▶│  调度器  │
│  操作    │     │  发起请求 │     │  路由    │     │  分配任务 │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                           │
     ┌──────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  引擎    │────▶│  执行    │────▶│  录像    │────▶│  报告    │
│  创建会话 │     │  测试步骤 │     │  截图表征 │     │  生成    │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                         │
     ┌────────────────────────────────────────────────────┘
     │
     ▼
┌──────────┐     ┌──────────┐     ┌──────────┐
│  存储    │◀────│  回写    │◀────│  推送    │
│  结果    │     │  数据库  │     │  WebSocket│
└──────────┘     └──────────┘     └──────────┘
```

## 4. 数据库设计

### 4.1 核心表结构

```sql
-- 项目表
CREATE TABLE project (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 测试套件表
CREATE TABLE test_suite (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    engine_type VARCHAR(20) DEFAULT 'appium', -- 'appium', 'midscene', 'airtest'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 测试用例表
CREATE TABLE test_case (
    id SERIAL PRIMARY KEY,
    suite_id INTEGER REFERENCES test_suite(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL, -- 'native', 'webview', 'h5'
    content JSONB NOT NULL, -- 用例内容
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 设备表
CREATE TABLE device (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'android', 'ios', 'browser'
    manufacturer VARCHAR(50),
    model VARCHAR(50),
    os_version VARCHAR(20),
    status VARCHAR(20) DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 执行记录表
CREATE TABLE test_execution (
    id SERIAL PRIMARY KEY,
    suite_id INTEGER REFERENCES test_suite(id),
    device_id INTEGER REFERENCES device(id),
    status VARCHAR(20) DEFAULT 'pending',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER, -- 执行时长（秒）
    total_steps INTEGER DEFAULT 0,
    passed_steps INTEGER DEFAULT 0,
    failed_steps INTEGER DEFAULT 0,
    report_path VARCHAR(500),
    video_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 执行日志表
CREATE TABLE execution_log (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER REFERENCES test_execution(id) ON DELETE CASCADE,
    step_index INTEGER,
    action VARCHAR(100),
    target VARCHAR(200),
    status VARCHAR(20),
    message TEXT,
    screenshot_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用例-套件关联表
CREATE TABLE test_case_suite (
    case_id INTEGER REFERENCES test_case(id) ON DELETE CASCADE,
    suite_id INTEGER REFERENCES test_suite(id) ON DELETE CASCADE,
    PRIMARY KEY (case_id, suite_id)
);

-- 索引
CREATE INDEX idx_execution_status ON test_execution(status);
CREATE INDEX idx_execution_suite ON test_execution(suite_id);
CREATE INDEX idx_device_status ON device(status);
CREATE INDEX idx_log_execution ON execution_log(execution_id);
```

## 5. API 设计

### 5.1 RESTful API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| **项目** | | |
| GET | /api/v1/projects | 获取项目列表 |
| POST | /api/v1/projects | 创建项目 |
| GET | /api/v1/projects/:id | 获取项目详情 |
| PUT | /api/v1/projects/:id | 更新项目 |
| DELETE | /api/v1/projects/:id | 删除项目 |
| **用例** | | |
| GET | /api/v1/cases | 获取用例列表 |
| POST | /api/v1/cases | 创建用例 |
| GET | /api/v1/cases/:id | 获取用例详情 |
| PUT | /api/v1/cases/:id | 更新用例 |
| DELETE | /api/v1/cases/:id | 删除用例 |
| POST | /api/v1/cases/:id/run | 执行单个用例 |
| **套件** | | |
| GET | /api/v1/suites | 获取套件列表 |
| POST | /api/v1/suites | 创建套件 |
| POST | /api/v1/suites/:id/run | 执行套件 |
| **执行** | | |
| GET | /api/v1/executions | 获取执行记录 |
| GET | /api/v1/executions/:id | 获取执行详情 |
| POST | /api/v1/executions/:id/stop | 停止执行 |
| GET | /api/v1/executions/:id/logs | 获取执行日志 |
| GET | /api/v1/executions/:id/video | 获取视频 |
| **设备** | | |
| GET | /api/v1/devices | 获取设备列表 |
| POST | /api/v1/devices | 注册设备 |
| PUT | /api/v1/devices/:id | 更新设备 |
| DELETE | /api/v1/devices/:id | 删除设备 |
| GET | /api/v1/devices/:id/status | 获取设备状态 |

### 5.2 WebSocket 端点

| 事件 | 方向 | 描述 |
|------|------|------|
| execution:start | Server→Client | 执行开始 |
| execution:progress | Server→Client | 执行进度 |
| execution:step | Server→Client | 单步完成 |
| execution:screenshot | Server→Client | 截图推送 |
| execution:complete | Server→Client | 执行完成 |
| device:status | Server→Client | 设备状态变更 |

## 6. 部署架构

### 6.1 开发/测试环境

```
┌────────────────────────────────────────────────────┐
│                    开发机器                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 前端服务  │  │ 后端服务  │  │ 设备连接  │        │
│  │ :3000    │  │ :4000    │  │ ADB      │        │
│  └──────────┘  └──────────┘  └──────────┘        │
│                     │                              │
│              ┌──────┴──────┐                        │
│              │ PostgreSQL  │                        │
│              │   :5432    │                        │
│              └─────────────┘                        │
└────────────────────────────────────────────────────┘
```

### 6.2 生产环境

```
┌─────────────────────────────────────────────────────────────────┐
│                         负载均衡层                               │
│                    (Nginx / 云负载均衡)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
┌───────────────────┐                   ┌───────────────────┐
│   Web 服务器集群   │                   │   API 服务器集群   │
│   (Nginx + 静态)   │                   │   (Node.js/Python)│
│   :80/:443         │                   │   :4000           │
└───────────────────┘                   └───────────────────┘
                                                      │
                              ┌─────────────────────┼─────────────────────┐
                              │                     │                     │
                              ▼                     ▼                     ▼
                    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
                    │   PostgreSQL    │   │      Redis      │   │   文件存储      │
                    │   主从集群      │   │    主从集群     │   │   (MinIO/S3)    │
                    │   :5432        │   │   :6379         │   │                 │
                    └─────────────────┘   └─────────────────┘   └─────────────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │  执行节点集群   │
                                            │  (Worker Nodes) │
                                            │  - Appium 服务  │
                                            │  - Midscene.js  │
                                            │  - FFmpeg       │
                                            └─────────────────┘
                                                      │
                              ┌─────────────────────┴─────────────────────┐
                              │                                           │
                              ▼                                           ▼
                    ┌─────────────────┐                         ┌─────────────────┐
                    │  Android 设备群  │                         │   浏览器集群     │
                    │  (真机/模拟器)   │                         │   (Playwright)   │
                    └─────────────────┘                         └─────────────────┘
```

## 7. 高可用设计

### 7.1 关键组件高可用

| 组件 | 高可用方案 | 故障转移时间 |
|------|-----------|-------------|
| API 服务 | 多实例 + 负载均衡 | < 30s |
| 执行引擎 | 容器化 + K8s 自动恢复 | < 60s |
| 数据库 | 主从复制 + 自动切换 | < 60s |
| Redis | Sentinel/Cluster 模式 | < 30s |
| 文件存储 | 多副本 + 跨区域 | < 5min |

### 7.2 降级策略

```
┌─────────────────────────────────────────────────────────────┐
│                     服务降级策略                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐    视频服务故障                        │
│  │   视频录制      │──────────────────────────────▶ 截图替代 │
│  │                 │                                     │
│  ├─────────────────┤    AI 服务故障                        │
│  │   Midscene.js   │──────────────────────────────▶ 回退到 │
│  │                 │                            传统定位   │
│  ├─────────────────┤    设备池满                           │
│  │   任务调度      │──────────────────────────────▶ 排队等待 │
│  │                 │                            + 告警     │
│  └─────────────────┘    数据库故障                         │
│                          │                                     │
│                          ▼                                     │
│                    本地缓存 + 事后同步                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 8. 安全设计

### 8.1 认证授权

```yaml
安全策略:
  - JWT Token 认证
  - Token 有效期: 24h (可刷新)
  - 敏感操作二次验证
  
权限模型:
  - 管理员: 全部权限
  - 开发者: 用例管理、执行测试
  - 测试人员: 执行测试、查看报告
  - 访客: 仅查看报告
```

### 8.2 数据安全

| 数据类型 | 安全措施 |
|---------|---------|
| 用户密码 | Bcrypt 哈希 |
| API Key | 加密存储 |
| 测试数据 | 隔离租户 |
| 视频文件 | 私有存储桶 |
| 日志 | 脱敏处理 |

---

**文档版本**: v1.0  
**更新日期**: 2026-04-13
