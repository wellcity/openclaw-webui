import { useState } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { LoginForm } from './components/LoginForm';
import { useGateway } from './hooks/useGateway';
import './App.css';

interface GatewayConfig {
  gatewayUrl: string;
  token: string;
  userId: string;
}

function App() {
  const [config, setConfig] = useState<GatewayConfig | null>(() => {
    const saved = localStorage.getItem('gateway_config');
    return saved ? JSON.parse(saved) : null;
  });

  const {
    connected,
    connecting,
    messages,
    loading,
    error,
    sessionKey,
    sendMessage,
    abortChat,
    clearMessages,
    reconnect,
  } = useGateway(
    config
      ? {
          gatewayUrl: config.gatewayUrl,
          token: config.token,
          userId: config.userId,
          workspace: `/ws/${config.userId}/`,
        }
      : { gatewayUrl: '', token: '', userId: '', workspace: '' }
  );

  const handleConnect = (newConfig: GatewayConfig) => {
    localStorage.setItem('gateway_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

  const handleLogout = () => {
    localStorage.removeItem('gateway_config');
    setConfig(null);
    window.location.reload();
  };

  // 未登入
  if (!config) {
    return <LoginForm onConnect={handleConnect} error={error} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h2>🤖 OpenClaw</h2>
        </div>
        <div className="header-right">
          <div className={`connection-dot ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`} />
          <span className="user-id">{config.userId}</span>
          <button className="logout-btn" onClick={handleLogout}>
            登出
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      <main className="app-main">
        <ChatWindow messages={messages} loading={loading} />
      </main>

      <footer className="app-footer">
        <ChatInput
          onSend={sendMessage}
          onStop={abortChat}
          loading={loading}
          disabled={!connected}
        />
      </footer>
    </div>
  );
}

export default App;
