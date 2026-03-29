import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayClient } from '../services/gatewayClient';
import type { GatewayConfig } from '../services/gatewayClient';
import type { ChatMessage } from '../types/gateway';

function extractTextFromContent(content: any): string {
  if (typeof content === 'string') {
    return content.replace(/<\/?final>/gi, '').trim();
  }
  if (Array.isArray(content)) {
    return content.map(block => {
      if (typeof block === 'string') return block;
      if (block.type === 'text') return (block.text || '').replace(/<\/?final>/gi, '').trim();
      if (block.type === 'thinking') return ''; // 過濾掉思考過程
      return '';
    }).filter(Boolean).join('');
  }
  return String(content).replace(/<\/?final>/gi, '').trim();
}

function parseHistoryMessages(history: any[]): ChatMessage[] {
  return (history || []).map((m: any) => ({
    id: m.id || `msg-${Date.now()}-${Math.random()}`,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: extractTextFromContent(m.content),
    timestamp: m.createdAt || Date.now(),
    status: 'done' as const,
  }));
}

export interface UseGatewayReturn {
  connected: boolean;
  connecting: boolean;
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  client: GatewayClient | null;
  sessionKey: string;
  sendMessage: (content: string) => Promise<void>;
  sendAdminCommand: (content: string) => Promise<void>;
  abortChat: () => Promise<void>;
  clearMessages: () => void;
  reconnect: () => Promise<void>;
}

export function useGateway(config: GatewayConfig): UseGatewayReturn {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<GatewayClient | null>(null);
  const sessionKey = `agent:main:web-user-${config.userId}`; // 每個使用者有自己的 session（gateway 會加前綴）
  const configRef = useRef(config);
  const [connectKey, setConnectKey] = useState(0);

  // configRef 保持最新，並在 config 實質變化時觸發重連
  useEffect(() => {
    const hasValidConfig = !!(
      config.gatewayUrl &&
      config.token &&
      config.userId
    );
    if (!hasValidConfig) return;

    configRef.current = config;
    clientRef.current?.disconnect();
    setConnected(false);
    setConnectKey(k => k + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gatewayUrl, config.token, config.userId]);

  const connect = useCallback(async () => {
    if (clientRef.current?.connected) return;

    setConnecting(true);
    setError(null);

    const client = new GatewayClient(configRef.current);
    clientRef.current = client;

    // 監聽 agent 事件（處理 life cycle）
    client.on('agent', (msg: any) => {
      const payload = msg.payload || msg;
      // 只處理屬於目前 session 的事件
      if (payload.sessionKey !== sessionKey) return;
      
      if (payload.data?.phase === 'start') {
        setLoading(true);
      }
      if (payload.data?.phase === 'end') {
        setLoading(false);
        // AI 回應結束，延遲後刷新歷史（給 API 時間寫入）
        const refreshHistory = async () => {
          for (let i = 0; i < 3; i++) {
            try {
              await new Promise(r => setTimeout(r, 800)); // 等待 800ms
              const history = await client.getHistory(sessionKey);
              const newMsgs = parseHistoryMessages(history.messages);
              if (newMsgs.length > 0) {
                setMessages(newMsgs.slice(-20));
                return;
              }
            } catch (e) {
              console.log('[useGateway] Retry fetch history:', i + 1);
            }
          }
        };
        refreshHistory();
      }
    });

    // 監聽 chat 事件
    client.on('chat', (msg: any) => {
      const payload = msg.payload || msg;
      // 只處理屬於目前 session 的事件
      if (payload.sessionKey !== sessionKey) return;
      
      if (payload.state === 'final') {
        setLoading(false);
      }
    });

    // 連線失敗
    client.on('connect.error', (msg: any) => {
      setError(msg.payload?.message || 'Connection failed');
      setConnecting(false);
    });

    try {
      await client.connect();
      setConnected(true);
      setConnecting(false);
      setError(null); // 清除之前的錯誤

      // 載入歷史訊息
      try {
        const history = await client.getHistory(sessionKey);
        if (history?.messages && history.messages.length > 0) {
          setMessages(parseHistoryMessages(history.messages).slice(-20));
        }
      } catch (e) {
        console.log('[useGateway] No history available');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setConnecting(false);
      setConnected(false);
    }
  }, [sessionKey]);

  useEffect(() => {
    if (!configRef.current.token) return;
    connect();
    return () => {
      clientRef.current?.disconnect();
    };
  }, [connectKey]);

  const sendMessage = useCallback(async (content: string) => {
    if (!clientRef.current) {
      setError('Not connected to gateway');
      return;
    }

    // 加入 user 訊息到 UI
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      await clientRef.current.sendMessage(content, sessionKey);
      // 等待回應，chat.history 會在 agent 事件結束時被調用
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, [sessionKey]);

  const sendAdminCommand = useCallback(async (content: string) => {
    if (!clientRef.current) {
      setError('Not connected to gateway');
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      await clientRef.current.sendAdminCommand(content);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const abortChat = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      await clientRef.current.abortChat(sessionKey);
      setLoading(false);
    } catch (err) {
      console.error('[useGateway] Abort failed:', err);
    }
  }, [sessionKey]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const reconnect = useCallback(async () => {
    clientRef.current?.disconnect();
    setConnected(false);
    setConnectKey(k => k + 1);
  }, []);

  return {
    connected,
    connecting,
    messages,
    loading,
    error,
    client: clientRef.current,
    sessionKey,
    sendMessage,
    sendAdminCommand,
    abortChat,
    clearMessages,
    reconnect,
  };
}
