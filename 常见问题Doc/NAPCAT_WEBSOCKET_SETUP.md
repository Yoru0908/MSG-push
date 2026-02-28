# NapCat WebSocket 服务端配置指南 (OneBot v11)

本指南用于指导如何配置 NapCat，为其开启 WebSocket 服务端功能，以便其他基于 OneBot v11 协议的程序（如我们的消息推送服务）能连接并接收/发送 QQ 消息。

---

## 方式一：通过 NapCat WebUI 配置（推荐）

如果你的 NapCat 开启了 WebUI 管理面板，这是最简单的无代码配置方式。

1. **登录 WebUI 面板**
   打开浏览器，访问你的 NapCat 服务器 IP 及 WebUI 端口（默认 `http://<服务器IP>:6099/webui`）。输入 Token 登录。

2. **进入网络配置**
   在左侧菜单栏中，找到并点击 **【网络配置】(Network)**。

3. **添加/修改 WebSocket 服务端**
   在页面中找到 **WebSocket 服务端 (WebSocket Servers)** 区域，点击 **添加** 或修改现有的配置，参数请严格按照以下要求填写：
   
   * **名称 (Name)**: `ws-server` (随意填写，仅作区分)
   * **启用 (Enable)**: 勾选 ✔️ (必须启用)
   * **主机 (Host)**: `0.0.0.0` (允许所有 IP 连接，或者根据安全需求填 `127.0.0.1` 仅限本机)
   * **端口 (Port)**: `3001` (这里以 `3001` 为例，请和推送程序里配置的 WS 地址端口保持一致)
   * **鉴权 Token (AccessToken)**: 留空 (如果为了安全设置了 Token，请务必让对接程序的 URL 里也带上 `?access_token=你的Token`)
   * **消息格式 (Message Post Format)**: 选择 `数组 (Array)` (非常重要，否则可能导致富媒体消息解析失败)
   * **上报自身消息**: 根据需要开启，一般默认即可
   * **推送事件**: 开启 (Enable Force Push Event)

4. **保存并重启**
   点击下方保存按钮。如果提示需要重启生效，请前往 **【系统】(System)** 页面点击重启 NapCat，或者在服务器终端手动重启容器。

---

## 方式二：手动修改配置文件 (JSON)

如果你是直接在服务器部署或者使用 Docker 的环境变量/挂载配置形式，可以直接修改你的账号配置文件。

1. **找到配置文件**
   配置文件的路径通常在 NapCat 的 `data` 目录下，文件名为：`onebot11_<机器人的QQ号码>.json`。
   * (Docker 默认路径大致为：`/app/napcat/config/onebot11_你的QQ号.json`)

2. **编辑 WebSocket 配置**
   打开该 JSON 文件，找到 `network` 对象。在里面的 `websocketServers` 数组中，添加或修改成如下配置：

```json
{
  "network": {
    "websocketServers": [
      {
        "name": "ws-server",
        "enable": true,
        "host": "0.0.0.0",
        "port": 3001,
        "accessToken": "",
        "messagePostFormat": "array",
        "reportSelfMessage": false,
        "enableForcePushEvent": true,
        "debug": false,
        "heartInterval": 30000
      }
    ]
  }
}
```

> **参数说明：**
> - `"host": "0.0.0.0"` 代表监听所有网卡，允许其他机器或容器访问。如果是同一台机器上的直连，改为 `"127.0.0.1"` 会更安全。
> - `"port": 3001` 是服务端监听的 WebSocket 端口。连接地址就是 `ws://服务器IP:3001`。
> - `"messagePostFormat": "array"` 这个是最关键的，目前很多新版插件都只兼容数组格式的消息段，不要用 `string`。

3. **保存并重启 NapCat**
   使用指令重启你的 NapCat 进程或 Docker 容器。例如：
   ```bash
   docker restart napcat
   ```

## 验证连接

配置正确并重启后，从 NapCat 的控制台日志中应该能看到类似的启动信息：
```text
[info] [Notice] [OneBot11] [network] 配置加载
WebSocket服务: 0.0.0.0:3001, : 已启动
[info] [OneBot] [WebSocket Server] Server Started :::3001
```
这就说明配置成功了！对接方程序只要填入 `ws://你的IP:3001` 即可连上。
