import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types/gateway';

interface Props {
  messages: ChatMessage[];
  loading: boolean;
}

export function ChatWindow({ messages, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="chat-empty">
        <div className="chat-empty-icon">💬</div>
        <p>開始和 AI 對話吧！</p>
        <p className="chat-empty-hint">訊息會在這裡顯示</p>
      </div>
    );
  }

  return (
    <div className="chat-window" ref={containerRef}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`chat-message chat-message-${msg.role} ${msg.status === 'sending' ? 'sending' : ''}`}
        >
          <div className="chat-message-avatar">
            {msg.role === 'user' ? '👤' : '🤖'}
          </div>
          <div className="chat-message-content">
            <div className="chat-message-text">
              {msg.content || (msg.status === 'sending' ? '思考中...' : '')}
            </div>
            <div className="chat-message-time">
              {new Date(msg.timestamp || Date.now()).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div className="chat-message chat-message-assistant loading">
          <div className="chat-message-avatar">🤖</div>
          <div className="chat-message-content">
            <div className="chat-message-text typing">
              <span className="typing-dot">●</span>
              <span className="typing-dot">●</span>
              <span className="typing-dot">●</span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
