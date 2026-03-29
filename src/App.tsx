import { useState } from 'react';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { StatusBar } from './components/StatusBar';
import { LoginForm } from './components/LoginForm';
import { AdminPanel } from './components/AdminPanel';
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
    sendAdminCommand,
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
        <h2>🤖 OpenClaw WebUI</h2>
        <div className="header-user">
          <span className="user-id">{config.userId}</span>
          <button className="logout-btn" onClick={handleLogout}>
            登出
          </button>
        </div>
      </header>

      <StatusBar
        connected={connected}
        connecting={connecting}
        sessionKey={sessionKey}
        onReconnect={reconnect}
        onClear={clearMessages}
      />

      {error && (
        <div className="error-banner" onClick={() => {}}>
          ⚠️ {error}
        </div>
      )}

      <main className="app-main">
        <ChatWindow messages={messages} loading={loading} />
      </main>

      <AdminPanel onSendCommand={sendAdminCommand} disabled={!connected || loading} />

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
