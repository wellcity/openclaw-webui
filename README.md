# OpenClaw WebUI

一個自訂的 React Web 介面，用於連接 OpenClaw Gateway，透過獨立的使用者 session 與 AI 對話。

## 功能特色

- 🔌 直接連接 OpenClaw Gateway WebSocket（支援 v2 device signature）
- 👤 多使用者支援（每個使用者有獨立 session `agent:main:web-user-<userId>`）
- 💬 即時聊天介面（氣泡樣式、思考中動畫）
- 🔄 自動重連
- 🚫 跨 session 事件過濾（只顯示目前使用者的訊息）
- 📱 響應式設計，LibreChat 風格配色

## 架構

```
┌──────────────┐     WebSocket      ┌─────────────────┐
│   React      │ ────────────────►  │   OpenClaw      │
│   WebUI      │   ws://host:18789 │   Gateway       │
│              │ ◄──────────────── │                 │
└──────────────┘    chat events   └────────┬────────┘
                                             │
                                   各使用者獨立 session
                                   sessionKey: agent:main:web-user-<userId>
```

## 技術棧

- **React 18** + TypeScript
- **Vite** 構建工具
- **WebCrypto API** 生成 RSA keypair 進行 v2 device signature
- **WebSocket** 即時通訊

## 開發

```bash
# 安裝依賴
npm install

# 開發模式
npm run dev

# 建構 production 版本
npm run build
```

## 設定

首次使用需要填入：

- **Gateway URL**: `ws://127.0.0.1:18789`（預設）
- **Gateway Token**: 在 OpenClaw 設定中取得
- **使用者 ID**: 用於區分不同使用者的 session（例：`bruce`、`alice`）

## Gateway 設定需求

### 1. Origin 允許清單

在 `~/.openclaw/openclaw.json` 中加入：

```json
{
  "gateway": {
    "controlUi": {
      "allowedOrigins": ["http://localhost:5173"]
    }
  }
}
```

重啟 Gateway：`openclaw gateway restart`

### 2. Device Auth（可選）

如果需要完整 operator scopes，需要在 Gateway 設定中啟用：

```json
{
  "gateway": {
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

## 工作原理

### 連線流程

1. 使用者輸入 Gateway URL、Token、User ID
2. WebUI 使用 **WebCrypto API** 生成 RSA keypair
3. 產生 **v2 signature**：格式為 `v2|{deviceId}|{clientId}|...`
4. 發送 `connect` 請求，帶 signature
5. Gateway 驗證通過後建立 session

### Session 隔離

- 每個 WebUI 使用者有獨立 session：`agent:main:web-user-{userId}`
- 事件監聽器會過濾 `sessionKey`，只處理屬於目前使用者的訊息
- 不同使用者的對話歷史不會互相干擾

### 訊息格式

- 發送：`chat.send` 帶 `message` 參數
- 接收：透過 `agent` 事件監聽回應狀態
- 歷史：透過 `chat.history` 取得，content 可能是陣列格式

## 部署

### 必要條件

- Gateway 必須允許 WebUI 的 origin（見上方設定）
- Token 必須有足夠的 operator scopes

### 建構

```bash
npm run build
# 輸出在 dist/ 目錄
```

### 托管

靜態檔案可部署到任何支援 WebSocket 的托管服務：
- Vercel
- Netlify
- 自行架設 nginx + WebSocket proxy

## 已知限制

- Workspace 隔離依賴 session key，不提供嚴格的檔案系統隔離
- `pathEnv` 參數目前 Gateway 接受但不會自動建立目錄
- 需要 Gateway 設定 `dangerouslyDisableDeviceAuth: true` 才能使用完整功能

## License

MIT
