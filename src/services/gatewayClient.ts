/**
 * OpenClaw Gateway WebSocket Client
 * 連接到 OpenClaw Gateway，處理握手、認證、訊息收發
 */

export interface GatewayConfig {
  gatewayUrl: string;
  token: string;
  userId: string;
  workspace: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'done' | 'error';
}

export interface GatewayMessage {
  type: 'req' | 'res' | 'event';
  id?: string;
  event?: string;
  payload?: any;
  ok?: boolean;
  error?: any;
}

type MessageHandler = (msg: GatewayMessage) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private config: GatewayConfig;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
  private messageId = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnected = false;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.gatewayUrl);
      } catch (err) {
        reject(new Error(`Invalid WebSocket URL: ${this.config.gatewayUrl}`));
        return;
      }

      this.ws.onmessage = (event) => this.handleMessage(event.data);
      this.ws.onopen = () => {
        console.log('[GatewayClient] WebSocket opened, waiting for challenge...');
        // 等待 challenge 後再送 connect
        this.once('connect.challenge', async () => {
          try {
            await this.sendConnect();
            this.isConnected = true;
            this.reconnectAttempts = 0;
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      };

      this.ws.onerror = (e) => {
        console.error('[GatewayClient] WebSocket error:', e);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (e) => {
        console.log(`[GatewayClient] WebSocket closed: ${e.code} - ${e.reason}`);
        this.isConnected = false;
        this.handleReconnect();
      };
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[GatewayClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  private async sendConnect(): Promise<void> {
    const nonce = this.generateNonce();
    const signedAt = Date.now();

    // Device identity (可改用實際的 device keypair)
    const deviceId = this.generateDeviceId();

    const result = await this.request('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-webui',
        version: '1.0.0',
        platform: 'web',
        mode: 'operator',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'sessions.manage'],
      auth: { token: this.config.token },
      sessionKey: `web-user-${this.config.userId}`,
      workspace: this.config.workspace,
      locale: navigator.language || 'zh-TW',
      userAgent: navigator.userAgent,
      device: {
        id: deviceId,
        nonce: nonce,
        signedAt: signedAt,
      },
    });

    console.log('[GatewayClient] Connected successfully:', result);
    return result;
  }

  private generateNonce(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateDeviceId(): string {
    // 產生穩定的 device fingerprint
    const stored = sessionStorage.getItem('openclaw_device_id');
    if (stored) return stored;
    const id = 'web-' + this.generateNonce();
    sessionStorage.setItem('openclaw_device_id', id);
    return id;
  }

  // ==================== API Methods ====================

  /**
   * 發送聊天訊息
   */
  async sendMessage(content: string, sessionKey?: string): Promise<{ runId: string; status: string }> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    return this.request('chat.send', {
      sessionKey: targetSession,
      content,
    });
  }

  /**
   * 查詢聊天歷史
   */
  async getHistory(sessionKey?: string, limit = 50): Promise<{ messages?: any[] }> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    return this.request('chat.history', {
      sessionKey: targetSession,
      limit,
    });
  }

  /**
   * 發送管理指令到 main session
   */
  async sendAdminCommand(content: string): Promise<{ runId: string; status: string }> {
    return this.request('chat.send', {
      sessionKey: 'main',
      content,
    });
  }

  /**
   * 中斷正在進行的 chat
   */
  async abortChat(sessionKey?: string): Promise<void> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    return this.request('chat.abort', {
      sessionKey: targetSession,
    });
  }

  /**
   * 取得系統健康狀態
   */
  async getHealth(): Promise<any> {
    return this.request('health', {});
  }

  /**
   * 取得模型列表
   */
  async listModels(): Promise<any[]> {
    return this.request('models.list', {});
  }

  /**
   * 取得所有 sessions
   */
  async listSessions(): Promise<any[]> {
    return this.request('sessions.list', {});
  }

  /**
   * 取得設定
   */
  async getConfig(): Promise<any> {
    return this.request('config.get', {});
  }

  // ==================== Event Handling ====================

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  once(event: string, handler: MessageHandler): void {
    const wrapped: MessageHandler = (msg) => {
      handler(msg);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }

  off(event: string, handler: MessageHandler): void {
    const list = this.handlers.get(event) || [];
    this.handlers.set(event, list.filter((h) => h !== handler));
  }

  // ==================== Internal ====================

  private async request(method: string, params: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = `req-${++this.messageId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method as string} timed out`));
      }, 60000); // 60s timeout

      this.pendingRequests.set(id, {
        resolve: (val) => { clearTimeout(timeout); resolve(val); },
        reject: (err) => { clearTimeout(timeout); reject(err); },
      });

      this.ws!.send(JSON.stringify({ type: 'req', id, method, params }));
    });
  }

  private handleMessage(data: string): void {
    let msg: GatewayMessage;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      console.error('[GatewayClient] Failed to parse message:', e);
      return;
    }

    // 事件廣播
    if (msg.type === 'event') {
      console.log('[GatewayClient] Event:', msg.event, msg.payload);
      const list = this.handlers.get(msg.event || '') || [];
      list.forEach((h) => h(msg));
      // wildcard handler
      this.handlers.get('*')?.forEach((h) => h(msg));
    }

    // 回應
    if (msg.type === 'res') {
      const pending = this.pendingRequests.get(msg.id!);
      if (pending) {
        this.pendingRequests.delete(msg.id!);
        if (msg.ok) {
          pending.resolve(msg.payload);
        } else {
          pending.reject(msg.error || new Error('Request failed'));
        }
      }
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    this.maxReconnectAttempts = 0; // 防止重連
    this.ws?.close();
  }
}
