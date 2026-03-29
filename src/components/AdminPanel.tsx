interface Props {
  onSendCommand: (command: string) => void;
  disabled: boolean;
}

export function AdminPanel({ onSendCommand, disabled }: Props) {
  const commands = [
    { label: '📊 系統狀態', cmd: '/status' },
    { label: '🔧 模型列表', cmd: '/models' },
    { label: '💾 Sessions', cmd: '/sessions' },
    { label: '📝 設定', cmd: '/config' },
    { label: '🔄 重新整理連線', cmd: '/reconnect' },
  ];

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">管理指令</div>
      <div className="admin-commands">
        {commands.map((c) => (
          <button
            key={c.cmd}
            className="admin-cmd-btn"
            onClick={() => onSendCommand(c.cmd)}
            disabled={disabled}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
