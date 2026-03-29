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
  timestamp?: number;
  createdAt?: number;
  updatedAt?: number;
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

// v2 簽名 payload 格式: v2|{deviceId}|{clientId}|{clientMode}|{role}|{scopes}|{signedAt}|{token}|{nonce}
function createV2Signature(deviceId: string, scopes: string[], signedAt: number, token: string, nonce: string, privateKey: CryptoKey): Promise<string> {
  const scopeStr = scopes.join(',');
  const sigInput = ['v2', deviceId, 'openclaw-control-ui', 'webchat', 'operator', scopeStr, signedAt, token, nonce].join('|');
  const encoded = new TextEncoder().encode(sigInput);
  return crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, encoded)
    .then(sig => btoa(String.fromCharCode(...new Uint8Array(sig))));
}

// 生成並儲存 device keypair
async function getOrCreateDeviceKey(): Promise<{ deviceId: string; publicKey: string; privateKey: CryptoKey }> {
  const stored = sessionStorage.getItem('openclaw_device_v2');
  if (stored) {
    const parsed = JSON.parse(stored);
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      Uint8Array.from(atob(parsed.privateKey), c => c.charCodeAt(0)),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      true,
      ['sign']
    );
    return { deviceId: parsed.deviceId, publicKey: parsed.publicKey, privateKey };
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign']
  );

  const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicKeyB64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyDer)));
  const privateKeyB64 = btoa(String.fromCharCode(...new Uint8Array(privateKeyDer)));

  const hashBuffer = await crypto.subtle.digest('SHA-256', publicKeyDer);
  const deviceId = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 40);

  sessionStorage.setItem('openclaw_device_v2', JSON.stringify({
    deviceId,
    publicKey: publicKeyB64,
    privateKey: privateKeyB64,
  }));

  return { deviceId, publicKey: publicKeyB64, privateKey: keyPair.privateKey };
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
  private connectResolve: ((value: void) => void) | null = null;
  private connectReject: ((reason: any) => void) | null = null;
  private deviceInfo: { deviceId: string; publicKey: string; privateKey: CryptoKey } | null = null;

  constructor(config: GatewayConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;

      try {
        this.deviceInfo = await getOrCreateDeviceKey();
      } catch (e) {
        console.warn('[GatewayClient] Failed to get device keys:', e);
      }

      try {
        this.ws = new WebSocket(this.config.gatewayUrl);
      } catch (err) {
        reject(new Error(`Invalid WebSocket URL: ${this.config.gatewayUrl}`));
        return;
      }

      this.ws.onmessage = (event) => this.handleMessage(event.data);
      this.ws.onopen = () => {
        console.log('[GatewayClient] WebSocket opened, waiting for challenge...');
      };

      this.ws.onerror = (e) => {
        console.error('[GatewayClient] WebSocket error:', e);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (e) => {
        console.log(`[GatewayClient] WebSocket closed: ${e.code}`);
        this.isConnected = false;
        this.handleReconnect();
      };
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[GatewayClient] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  private async sendConnect(): Promise<void> {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const signedAt = Date.now();
    const scopes = ['operator.admin', 'operator.approvals', 'operator.pairing', 'operator.read', 'operator.write'];

    const connectParams: any = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        version: '2026.3.28',
        platform: 'web',
        deviceFamily: 'browser',
        mode: 'webchat',
      },
      role: 'operator',
      scopes: scopes,
      auth: { token: this.config.token },
      locale: navigator.language || 'zh-TW',
      userAgent: navigator.userAgent,
      pathEnv: this.config.workspace || undefined,

    };

    if (this.deviceInfo) {
      const signature = await createV2Signature(
        this.deviceInfo.deviceId,
        scopes,
        signedAt,
        this.config.token,
        nonce,
        this.deviceInfo.privateKey
      );

      connectParams.device = {
        id: this.deviceInfo.deviceId,
        nonce: nonce,
        signedAt: signedAt,
        publicKey: this.deviceInfo.publicKey,
        signature: signature,
      };
    }

    const result = await this.request('connect', connectParams);
    console.log('[GatewayClient] Connected successfully');
    this.isConnected = true;
    return result;
  }

  // ==================== API Methods ====================

  async sendMessage(content: string, sessionKey?: string): Promise<{ runId: string; status: string }> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    const idempotencyKey = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return this.request('chat.send', {
      sessionKey: targetSession,
      message: content,
      idempotencyKey,
    });
  }

  async getHistory(sessionKey?: string, limit = 50): Promise<{ messages?: any[] }> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    return this.request('chat.history', {
      sessionKey: targetSession,
      limit,
    });
  }

  async sendAdminCommand(content: string): Promise<{ runId: string; status: string }> {
    const idempotencyKey = `admin-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    return this.request('chat.send', {
      sessionKey: 'agent:main:main',
      message: content,
      idempotencyKey,
    });
  }

  async abortChat(sessionKey?: string): Promise<void> {
    const targetSession = sessionKey || `web-user-${this.config.userId}`;
    return this.request('chat.abort', {
      sessionKey: targetSession,
    });
  }

  async getHealth(): Promise<any> {
    return this.request('health', {});
  }

  async listModels(): Promise<any[]> {
    return this.request('models.list', {});
  }

  async listSessions(): Promise<any[]> {
    return this.request('sessions.list', {});
  }

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
      }, 60000);

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

    if (msg.type === 'event') {
      console.log('[GatewayClient] Event:', msg.event);

      if (msg.event === 'connect.challenge') {
        this.sendConnect()
          .then(() => { this.connectResolve?.(); })
          .catch((e) => this.connectReject?.(e));
        return;
      }

      const list = this.handlers.get(msg.event || '') || [];
      list.forEach((h) => h(msg));
      this.handlers.get('*')?.forEach((h) => h(msg));
    }

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
    this.maxReconnectAttempts = 0;
    this.ws?.close();
  }
}
