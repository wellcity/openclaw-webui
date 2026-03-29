import { useState, type KeyboardEvent, type ChangeEvent } from 'react';

interface Props {
  onSend: (message: string) => void;
  onStop?: () => void;
  loading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, loading, disabled }: Props) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const text = message.trim();
    if (!text || loading || disabled) return;

    onSend(text);
    setMessage('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  return (
    <div className="chat-input-container">
      <textarea
        className="chat-input"
        value={message}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="輸入訊息... (Enter 傳送，Shift+Enter 換行)"
        disabled={disabled || loading}
        rows={1}
      />
      {loading ? (
        <button className="chat-send-btn stop" onClick={onStop} title="停止">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>
      ) : (
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          title="傳送"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
