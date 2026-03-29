# OpenClaw WebUI

一個自訂的 React Web 介面，用於連接 OpenClaw Gateway，透過獨立的 user session 與 AI 對話。

## 功能特色

- 🔌 直接連接 OpenClaw Gateway WebSocket
- 👤 多使用者支援（每個使用者有獨立 session + workspace）
- 💬 即時聊天介面（串流回應）
- 🎛️ 管理面板（系統狀態、模型列表等）
- 🔄 自動重連
- 📱 響應式設計

## 架構

```
┌──────────────┐     WebSocket      ┌─────────────────┐
│   React      │ ────────────────►  │   OpenClaw      │
│   WebUI      │   ws://host:18789  │   Gateway       │
│              │ ◄────────────────  │                 │
└──────────────┘    chat events     └────────┬────────┘
                                             │
                                   各使用者獨立 session
                                   workspace: /ws/<userId>/
```

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
- **使用者 ID**: 用於區分不同使用者的 session

## 部署

### Vercel / Netlify

```bash
npm run build
# 將 dist 目錄部署到靜態托管
```

### Docker

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

### 自行架設

```bash
# 建構
npm run build

# 使用 any websocket proxy (如 nginx + ws) 或直接服務靜態檔案
# 注意：需支援 WebSocket
```

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `VITE_GATEWAY_URL` | 預設 Gateway URL | `ws://127.0.0.1:18789` |

## License

MIT
