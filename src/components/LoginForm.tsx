import { useState, type ChangeEvent, type FormEvent } from 'react';

interface Props {
  onConnect: (config: { gatewayUrl: string; token: string; userId: string }) => void;
  error?: string | null;
}

export function LoginForm({ onConnect, error }: Props) {
  const [gatewayUrl, setGatewayUrl] = useState(() => {
    return localStorage.getItem('gateway_url') || 'ws://127.0.0.1:18789';
  });
  const [token, setToken] = useState(() => localStorage.getItem('gateway_token') || '');
  const [userId, setUserId] = useState(() => localStorage.getItem('user_id') || `user-${Date.now() % 10000}`);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('gateway_url', gatewayUrl);
    localStorage.setItem('gateway_token', token);
    localStorage.setItem('user_id', userId);
    onConnect({ gatewayUrl, token, userId });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🤖 OpenClaw WebUI</h1>
        <p className="login-subtitle">連接到你的 OpenClaw Gateway</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="gatewayUrl">Gateway URL</label>
            <input
              id="gatewayUrl"
              type="text"
              value={gatewayUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setGatewayUrl(e.target.value)}
              placeholder="ws://127.0.0.1:18789"
              required
            />
            <span className="form-hint">WebSocket 地址（預設: 127.0.0.1:18789）</span>
          </div>

          <div className="form-group">
            <label htmlFor="token">Gateway Token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setToken(e.target.value)}
              placeholder="輸入你的 gateway token"
              required
            />
            <span className="form-hint">可在 OpenClaw 設定中取得</span>
          </div>

          <div className="form-group">
            <label htmlFor="userId">使用者 ID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUserId(e.target.value)}
              placeholder="your-user-id"
              required
            />
            <span className="form-hint">用於區分不同使用者的 session</span>
          </div>

          {error && <div className="form-error">{error}</div>}

          <button type="submit" className="login-btn">
            連線
          </button>
        </form>
      </div>
    </div>
  );
}
