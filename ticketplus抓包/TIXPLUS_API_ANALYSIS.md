# Tixplus 抓包分析完整总结

📅 **分析日期**: 2025-12-16  
📱 **App版本**: 7.1.0  
📦 **抓包工具**: mitmproxy  
📂 **数据来源**: flows (16.9MB)

---

## 🌐 域名分布

| 域名 | 请求数 | 用途 |
|------|--------|------|
| `tixplus.jp` | ~69 | 主站 Web 页面 + 部分 API |
| `emtg-npf.emtg.jp` | ~30 | **核心 API 服务** |
| `s3-ap-northeast-1.amazonaws.com` | ~21 | 图片/资源存储 |
| `d2ykgxalpruhza.cloudfront.net` | ~72 | CDN 静态资源 |

---

## 🎭 顔写真相关接口（核心）

### 1️⃣ 检查顔写真状态

```
POST https://emtg-npf.emtg.jp/img/eticket-face-picture/check/tixplus
```

**请求体**:
```json
{
    "lang_code": "ja",
    "uuid": "6afe7872-52da-4485-cd92-3a72399fae6b",
    "app_aid": "",
    "fpid": "",
    "app_uid": "",
    "sdk_version": "2.2.0",
    "relation_id": "E10158461948|O100012105145929|0",
    "DeviceToken": "6d0006b3aafda6fe04c5089e362f3f7516e510beb0349d56f9e4fd11b0d32fed",
    "user_id": "7698763"
}
```

**响应** (413 bytes):
```json
{
    "status": 1,
    "response": {
        "result": true,
        "url": "https://s3-ap-northeast-1.amazonaws.com/emtg.jp/tixplus_face_pictures/trimmed/929/{hash}.jpg",
        "lkey": "2b200d9105433301d41d8376a0c59b5a050df5966831b357c1abd5bffb8573a2",
        "fp_last_update_time": 1714763560,
        "fp_last_update_milli": 1714763560000
    }
}
```

**关键发现**:
- `url` = 图片在 S3 的公开访问地址
- `lkey` = 可能是验证密钥
- `fp_last_update_time` = 最后更新时间 (2024-05-03)

### 2️⃣ 加载顔写真

```
POST https://emtg-npf.emtg.jp/img/eticket-face-picture/load/tixplus
```

**响应大小**: 70,019 bytes (包含 Base64 编码的图片)

### 3️⃣ 图片存储位置

```
https://s3-ap-northeast-1.amazonaws.com/emtg.jp/tixplus_face_pictures/trimmed/{用户ID后3位}/{长hash}.jpg
```

| 属性 | 值 |
|------|-----|
| 存储桶 | `emtg.jp` |
| 路径格式 | `tixplus_face_pictures/trimmed/{后3位}/{hash}.jpg` |
| 访问权限 | ⚠️ **公开可访问，无需认证** |

---

## 🎫 票据相关接口

### 主要接口列表

| 接口 | 方法 | 响应大小 | 用途 |
|------|------|----------|------|
| `/api/list_load/tixplus` | POST | 245B / 432KB | 完整票据信息 |
| `/api/check_unopen_tickets/tixplus` | POST | 58B | 检查未使用票 |
| `/api/data_lock/tixplus` | POST | 43B | 数据锁定 (防篡改) |
| `/api/profile/check/tixplus` | GET | 55B | 检查个人资料 |

### list_load 响应结构

**响应大小**: 432,404 bytes (完整票据数据)

```json
{
    "status": 1,
    "response": {
        "info": {
            "mst_artists": "list with 2 items",
            "mst_tours": "list with 10 items",
            "mst_concerts": "list with 11 items",
            "mst_tickets": "list with 11 items",
            "user_ticket_bg_picture_url_map": "list with 11 items",
            "mst_trade_info": "list with 11 items",
            "user_tickets": "list with 11 items",
            "user_ticket_seats": "list with 11 items",
            "mst_ticket_info": "list with 11 items",
            "users": "list with 1 items",
            "mst_stamps": "list with 10 items"
        },
        "config": {
            "isShowMemocolleListLink": 0
        },
        "user_ticket_ids": [22144465, 29561224, ...]
    }
}
```

---

## 📱 SMS 验证接口

| 接口 | 用途 | 响应大小 |
|------|------|----------|
| `/api/send_sms_auth_number/tixplus` | 发送验证码 | 115B |
| `/api/check_sms_auth/tixplus` | 验证验证码 | 267B |
| `/sms/tixplus?user_id=7698763` | SMS 验证页面 | 69KB |

### 发送验证码响应

```json
{
    "status": 1,
    "response": {
        "session_id": "04f123570bf37ff22c390f177996c266342245e1",
        "result_code": "0000"
    }
}
```

### 验证成功响应

```json
{
    "status": 1,
    "response": {
        "message": {
            "title": "認証が完了しました",
            "message": ""
        },
        "redirect_url": "/myticket",
        "familyname": "XIE",
        "firstname": "JIAJIE",
        "familyname_kana": "シャ",
        "firstname_kana": "カケツ"
    }
}
```

---

## 🔐 认证相关接口

| 接口 | 用途 | 响应大小 |
|------|------|----------|
| `/api/version_check/tixplus` | 版本检查 | 56B |
| `/api/login_check/tixplus` | 登录检查 | 326B |
| `tixplus.jp/login/check.php` | Web 登录 | - |

### 登录检查错误响应示例

```json
{
    "status": 0,
    "response": {
        "err_code": "1003",
        "msg_code": "E200007",
        "msg_text": {
            "title": "失敗しました",
            "message": "電話番号認証が必要です。(E200007)"
        },
        "transfer_url": "/myticket/tixplus?user_id=7698763&uuid=..."
    }
}
```

---

## 🎨 资源文件 (S3)

### 路径格式

| 路径格式 | 示例 | 用途 |
|----------|------|------|
| `/emtg.jp/feature/tos_ticket_app/tour_{活动ID}.jpg` | `tour_12102.jpg` | 活动封面 |
| `/emtg.jp/feature/tos_ticket_app/stamp_{活动ID}_{印章ID}.png` | `stamp_12102_39969.png` | 入场印章 |
| `/emtg.jp/feature/tos_ticket_app/{活动ID}/2/{背景ID}/background/iphone_4inch.png` | `13168/2/9217/background/` | 票面背景 |
| `/emtg.jp/tixplus_face_pictures/trimmed/{后3位}/{hash}.jpg` | | 顔写真 |
| `/emtg.jp/schedule_img/{时间戳}.jpg` | `251216061754.jpg` | 活动日程图 |
| `/npf.emtg.jp/staging/emtgticket/{活动ID}_{时间戳}_thumb.png` | `13361_20251201164115_thumb.png` | 票据缩略图 |
| `/npf.emtg.jp/staging/emtgstamp/{印章ID}_{时间戳}.png` | `9142_20251201164349.png` | 印章资源 |
| `/dev-tguard.emtg.jp/feature/tos_ticket_app/default_2024/background/` | | 默认背景模板 |

### 🕐 时间戳格式

| 位置 | 示例 | 格式 | 长度 |
|------|------|------|------|
| `schedule_img/` | `251216061754` | **YYMMDDHHmmss** | 12位 |
| `emtgticket/`, `emtgstamp/` | `20251201164115` | **YYYYMMDDHHmmss** | 14位 |

解析示例:
- `251216061754` = 2025-12-16 06:17:54
- `20251201164115` = 2025-12-01 16:41:15

### 🔓 资源可访问性分析

| 资源类型 | 可枚举? | 原因 |
|---------|---------|------|
| **活动封面** `tour_{id}.jpg` | ✅ **可以** | ID是5位数字递增，可暴力枚举 |
| **入场印章** `stamp_{tour}_{stamp}.png` | ⚠️ 困难 | 需知道 活动ID + 印章ID 的精确组合 |
| **票面背景** `{tour}/2/{bg}/background/` | ⚠️ 困难 | 需知道 活动ID + 背景ID，背景ID连续(如9217,9218) |
| **票据缩略图** `emtgticket/{id}_{ts}_thumb.png` | ❌ **不行** | 需要精确到秒的时间戳，无法猜测 |
| **emtgstamp** `emtgstamp/{id}_{ts}.png` | ❌ **不行** | 需要精确到秒的时间戳，无法猜测 |
| **顔写真** `tixplus_face_pictures/` | ❌ **不行** | 需要SHA512级别的hash，无法枚举 |

### 📊 活动封面可访问性测试结果 (12100-12400范围)

```
✅ 共 85 个活动封面可公开访问

部分示例:
tour_12101.jpg, tour_12102.jpg, tour_12130.jpg, tour_12225.jpg, tour_12226.jpg
tour_12300.jpg, tour_12312.jpg (453KB大图), tour_12346.jpg (633KB大图)
```

**结论**: 活动封面是最容易获取的资源，可以直接枚举5位ID。其他资源需要从API响应(如list_load)中获取精确的ID组合或时间戳。

### 已捕获的资源

```
tour_11644.png (403-需登录)
tour_12101.jpg ✅
tour_12102.jpg + stamp_12102_39969.png ✅
tour_12225.jpg ✅
tour_12226.jpg ✅
tour_12874.jpg ✅
tour_13168.jpg + stamp_13168_46118.png + 13168/2/9217/background ✅
13361/2/9398/background + 13361_20251201164115_thumb.png ✅
9142_20251201164349.png (emtgstamp) ✅
```

---

## 🎫 印章类型详细分析

### 两种印章存储路径

| 属性 | **feature路径** | **staging路径** |
|------|-----------------|-----------------|
| **完整路径** | `s3://emtg.jp/feature/tos_ticket_app/stamp_{tourId}_{stampId}.png` | `s3://npf.emtg.jp/staging/emtgstamp/{id}_{timestamp}.png` |
| **命名格式** | `stamp_{活动ID}_{印章ID}.png` | `{印章ID}_{YYYYMMDDHHmmss}.png` |
| **示例** | `stamp_12102_39969.png` | `9142_20251201164349.png` |
| **可枚举** | ✅ 知道 tourId 可暴力枚举 stampId | ❌ 需要精确时间戳 |
| **使用趋势** | 旧活动 | ⭐ 新活动 |

### 从 API 获取印章 URL

**API 端点**:
```
POST https://emtg-npf.emtg.jp/api/list_load/tixplus
```

**响应中的印章数据** (`mst_stamps`):
```json
{
  "mst_stamps": [
    {
      "mst_stamp_id": 6230,
      "stamp_image_url": "https://s3-ap-northeast-1.amazonaws.com/emtg.jp/feature/tos_ticket_app/stamp_12102_39969.png",
      "stamp_passcode": "1577",
      "stamp_cancel_passcode": ""
    },
    {
      "mst_stamp_id": 9142,
      "stamp_image_url": "https://s3.ap-northeast-1.amazonaws.com/npf.emtg.jp/staging/emtgstamp/9142_20251201164349.png",
      "stamp_passcode": "1577",
      "stamp_cancel_passcode": "1577"
    }
  ]
}
```

### 获取条件

| 条件 | 是否需要 |
|------|---------|
| 登录账号 | ✅ 需要 `user_id`, `uuid`, `DeviceToken` |
| 购买该活动的票 | ✅ 票必须在账户名下 |
| 入场验证 | ❌ **不需要** |

### 时间戳含义

| 时间 | 位置 | 含义 |
|------|------|------|
| `20251201164349` | URL 文件名 | **印章图片创建时间** (服务器生成) |
| `stamped_at` | `user_tickets` 字段 | 实际入场验证时间 |

**示例**:
- 印章图片创建: 2025-12-01 16:43:49 (提前8天)
- 活动日期: 2025-12-09
- 实际入场时间: 由 `stamped_at` 记录

### 印章获取流程

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│   买票      │ → │  登录 App    │ → │  list_load    │
└─────────────┘    └──────────────┘    └───────┬───────┘
                                               │
                                               ↓
                                    ┌───────────────────┐
                                    │  mst_stamps 包含  │
                                    │  完整 stamp_url   │
                                    │  (含时间戳)       │
                                    └───────────────────┘
                                               │
                                               ↓
                                    ┌───────────────────┐
                                    │  URL 公开可访问   │
                                    │  无需额外认证     │
                                    └───────────────────┘
```

### 已下载的印章列表

保存位置: `demo/assets/stamps/`

| 文件名 | mst_stamp_id | 大小 | 路径类型 |
|--------|-------------|------|----------|
| `stamp_7929_17520.png` | 4150 | 65KB | feature |
| `stamp_9699_26936.png` | 4973 | 114KB | feature |
| `stamp_11644_38730.png` | 6121 | 58KB | feature |
| `stamp_11877_38685.png` | 6106 | 57KB | feature |
| `stamp_12101_39968.png` | 6229 | 68KB | feature |
| `stamp_12102_39969.png` | 6230 | 59KB | feature |
| `stamp_12225_41296.png` | 6356 | 31KB | feature |
| `stamp_12226_40882.png` | 6317 | 51KB | feature |
| `stamp_13168_46118.png` | 6916 | 47KB | feature |
| `9142_20251201164349.png` | 9142 | 55KB | ⭐ **staging** |

### 枚举策略

| 路径类型 | 策略 |
|---------|------|
| **feature** | 知道 `tourId` 后，枚举 `stampId` (范围约 38000-50000) |
| **staging** | ❌ 无法枚举，必须从 `list_load` API 获取 |

---

## 📊 活动ID分析

| 活动ID | 资源 | 备注 |
|--------|------|------|
| 11644 | tour_11644.png | |
| 12101 | tour_12101.jpg | |
| 12102 | tour + stamp_39969 | ✅有印章 |
| 12225 | tour_12225.jpg | |
| 12226 | tour_12226.jpg | |
| 12874 | tour_12874.jpg | |
| 13168 | tour + stamp_46118 + 背景 | ✅有印章+背景 |
| 13361 | 背景 + 缩略图 | 最新活动 |

**规律**:
- ID 范围: 11644 ~ 13361 (5位数)
- 存在成对 ID: 12101/12102, 12225/12226

---

## 🔑 通用请求参数

```json
{
    "user_id": "7698763",
    "uuid": "6afe7872-52da-4485-cd92-3a72399fae6b",
    "DeviceToken": "6d0006b3aafda6fe04c5089e362f3f7516e510beb0349d56f9e4fd11b0d32fed",
    "sdk_version": "2.2.0",
    "lang_code": "ja",
    "relation_id": "E10158461948|O100012105145929|{flag}"
}
```

### relation_id 格式解析

```
E10158461948|O100012105145929|{flag}
    │              │           │
    │              │           └── 状态标志 (0/1)
    │              └── 订单ID (O + 15位)
    └── EMTG用户ID (E + 11位)
```

### 常见 Headers

```
Cookie: laravel_session=...; XSRF-TOKEN=...
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) ... App version 7.1.0
```

---

## 🎯 关键发现

| 发现 | 详情 |
|------|------|
| 🔓 顔写真可公开访问 | S3 URL 无需认证即可访问 |
| 📤 官方上传入口 | `https://tixplus.jp/member/mypage/tixplus_img_upload/` |
| 🎫 印章是服务器控制的 | 入场后由服务器分配印章图片 |
| 📦 list_load 包含完整状态 | 432KB 响应包含所有票据详情 |
| 📱 SMS 验证必须 | 每次新设备登录需 SMS 验证 (E200007错误) |
| 🔄 多次重复请求 | login_check 被调用4次，可能有重试机制 |

---

## 🛠️ 替换方案总结

基于抓包分析，有以下替换顔写真的方式：

| 方案 | 技术路径 | 难度 | 可行性 |
|------|----------|------|--------|
| 1️⃣ 官方上传 | 通过 `/member/mypage/tixplus_img_upload/` | ⭐ | ✅ 最简单 |
| 2️⃣ mitmproxy 替换 | 拦截 S3 图片请求或 load 接口 | ⭐⭐ | ✅ 需要代理环境 |
| 3️⃣ Cloudflare Worker | 中间人代理替换 S3 请求 | ⭐⭐⭐ | ⚠️ 需要 DNS 控制 |

---

## 📁 相关文件

```
ticketplus抓包/
├── flows              # 原始抓包数据 (16.9MB)
├── replace_face.py    # mitmproxy 替换脚本
├── fake_face.jpg      # 替换用的图片
├── demo/              # 票面UI演示
│   ├── index.html
│   ├── style.css
│   └── debug_gui.js
└── TIXPLUS_API_ANALYSIS.md  # 本文档
```
