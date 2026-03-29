// OpenClaw Gateway Protocol TypeScript Types

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: ClientInfo;
  role: 'operator' | 'node';
  scopes: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  auth: { token?: string; password?: string };
  locale?: string;
  userAgent?: string;
  sessionKey?: string;
  workspace?: string;
  device?: DeviceIdentity;
}

export interface ClientInfo {
  id: string;
  version: string;
  platform: string;
  mode: 'operator' | 'node';
}

export interface DeviceIdentity {
  id: string;
  publicKey?: string;
  signature?: string;
  signedAt?: number;
  nonce?: string;
}

export interface ConnectResponse {
  type: 'hello-ok';
  protocol: number;
  policy: {
    tickIntervalMs: number;
  };
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
  };
}

export interface ChatEvent {
  id?: string;
  runId?: string;
  sessionKey?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  status?: 'started' | 'done' | 'error' | 'in_flight';
  toolCalls?: ToolCall[];
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface SessionInfo {
  key: string;
  createdAt: number;
  updatedAt: number;
  model?: string;
  thinking?: boolean;
  verbose?: boolean;
  messages?: ChatMessage[];
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

// Scopes
export const Scopes = {
  OPERATOR_READ: 'operator.read',
  OPERATOR_WRITE: 'operator.write',
  OPERATOR_ADMIN: 'operator.admin',
  OPERATOR_APPROVALS: 'operator.approvals',
  OPERATOR_PAIRING: 'operator.pairing',
  SESSIONS_MANAGE: 'sessions.manage',
} as const;
