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
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages.length]); // 只在數量變化時滑動，不要每次 content 更新都滑

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
          className={`chat-message chat-message-${msg.role}`}
        >
          <div className="chat-message-avatar">
            {msg.role === 'user' ? '👤' : '🤖'}
          </div>
          <div className="chat-message-content">
            <div className="chat-message-bubble">
              {msg.content || (msg.status === 'sending' ? '思考中...' : '')}
            </div>
            <div className="chat-message-time">
              {new Date(msg.timestamp || Date.now()).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
      {loading && (
        <div className="chat-message chat-message-assistant">
          <div className="chat-message-avatar">🤖</div>
          <div className="chat-message-content">
            <div className="chat-message-bubble typing">
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
