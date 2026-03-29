interface Props {
  connected: boolean;
  connecting: boolean;
  sessionKey: string;
  onReconnect: () => void;
  onClear: () => void;
}

export function StatusBar({ connected, connecting, sessionKey, onReconnect, onClear }: Props) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <div className={`status-indicator ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`}>
          <span className="status-dot" />
          <span className="status-text">
            {connected ? '已連線' : connecting ? '連線中...' : '未連線'}
          </span>
        </div>
        <div className="session-info">
          Session: <code>{sessionKey}</code>
        </div>
      </div>
      <div className="status-right">
        {!connected && !connecting && (
          <button className="status-btn" onClick={onReconnect}>
            重新連線
          </button>
        )}
        <button className="status-btn" onClick={onClear}>
          清除聊天
        </button>
      </div>
    </div>
  );
}
