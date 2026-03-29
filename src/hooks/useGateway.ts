import { useState, useEffect, useCallback, useRef } from 'react';
import { GatewayClient } from '../services/gatewayClient';
import type { GatewayConfig } from '../services/gatewayClient';
import type { ChatMessage } from '../types/gateway';

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
  const sessionKey = `web-user-${config.userId}`;

  const connect = useCallback(async () => {
    if (clientRef.current?.connected) return;

    setConnecting(true);
    setError(null);

    const client = new GatewayClient(config);
    clientRef.current = client;

    // 監聽 chat 事件
    client.on('chat', (msg: any) => {
      const payload = msg.payload || msg;

      // 使用者訊息（自己的）
      if (payload.role === 'user') {
        setMessages((prev) => {
          const existing = prev.find((m) => m.id === payload.id);
          if (existing) {
            return prev.map((m) => m.id === payload.id ? { ...m, ...payload } : m);
          }
          return [...prev, {
            id: payload.id || `user-${Date.now()}`,
            role: 'user',
            content: payload.content || '',
            timestamp: payload.createdAt || Date.now(),
            status: 'done',
          }];
        });
      }

      // AI 回應（串流）
      if (payload.role === 'assistant') {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant' && !lastMsg.id) {
            // 更新現有訊息
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: (m.content || '') + (payload.content || ''), id: payload.id || m.id }
                : m
            );
          }
          // 新增 AI 訊息
          return [...prev, {
            id: payload.id || `assistant-${Date.now()}`,
            role: 'assistant',
            content: payload.content || '',
            timestamp: Date.now(),
            status: payload.status === 'done' ? 'done' : 'sending',
          }];
        });
      }

      // 完成
      if (payload.status === 'done' || payload.status === 'complete') {
        setLoading(false);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant' ? { ...m, status: 'done' as const } : m
          )
        );
      }

      // 錯誤
      if (payload.status === 'error' || payload.error) {
        setLoading(false);
        setError(payload.error || 'Unknown error');
      }
    });

    // 連線狀態事件
    client.on('system.presence', (msg: any) => {
      console.log('[useGateway] Presence update:', msg.payload);
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

      // 載入歷史訊息
      try {
        const history = await client.getHistory(sessionKey);
        if (history?.messages && history.messages.length > 0) {
          setMessages(history.messages.map((m: any) => ({
            id: m.id,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
            timestamp: m.createdAt,
            status: 'done' as const,
          })));
        }
      } catch (e) {
        console.log('[useGateway] No history available');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setConnecting(false);
      setConnected(false);
    }
  }, [config, sessionKey]);

  useEffect(() => {
    connect();

    return () => {
      clientRef.current?.disconnect();
    };
  }, [connect]);

  const sendMessage = useCallback(async (content: string) => {
    if (!clientRef.current) {
      setError('Not connected to gateway');
      return;
    }

    // 加入 user 訊息
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
    await connect();
  }, [connect]);

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
