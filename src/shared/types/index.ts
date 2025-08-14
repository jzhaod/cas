// Shared TypeScript type definitions

// Chrome Extension Types
export interface ChromeMessage {
  type: string;
  data?: any;
  [key: string]: any;
}

export interface ChromeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Product Information Types
export interface ProductInfo {
  id: string;
  asin: string;
  name: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  category?: string;
  seller: string;
  rating?: number;
  reviewCount?: number;
  availability: 'in_stock' | 'out_of_stock' | 'limited';
  url: string;
}

// User Behavior Types
export interface UserBehavior {
  productId: string;
  dwellTime: number;
  interactions: string[];
  priceChecks: number;
  addToCartAttempts: number;
  wishlistAdds: number;
  interestScore: number;
  timestamp: Date;
}

// Negotiation Types
export interface NegotiationSession {
  sessionId: string;
  productId: string;
  productInfo: ProductInfo;
  behavior: UserBehavior;
  status: 'pending' | 'active' | 'completed' | 'failed';
  sellerEndpoint?: string;
  currentOffer?: NegotiationOffer;
  negotiationLog: NegotiationStep[];
  startTime: Date;
  lastUpdate: Date;
  expiresAt: Date;
}

export interface NegotiationOffer {
  id: string;
  price: number;
  currency: string;
  discountPercent: number;
  savings: number;
  terms?: {
    quantity?: number;
    bundleItems?: string[];
    validUntil?: Date;
    conditions?: string[];
  };
  message?: string;
}

export interface NegotiationStep {
  round: number;
  action: 'analyze' | 'offer' | 'counter' | 'accept' | 'reject';
  details: any;
  timestamp: Date;
  reasoning?: string;
}

// Seller Types
export interface SellerEndpoint {
  sellerId: string;
  sellerName: string;
  mcpEndpoint: string;
  apiKey?: string;
  capabilities: string[];
  metadata: {
    rating: number;
    averageResponseTime: number;
    successRate: number;
    specialties: string[];
    supportedPayments: string[];
    shippingRegions: string[];
  };
  contact: {
    email?: string;
    website?: string;
    supportUrl?: string;
  };
}

// MCP Protocol Types
export interface MCPToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// AI Agent Types
export interface AIAgentConfig {
  llmProvider: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  model: string;
  temperature?: number;
  maxNegotiationRounds: number;
  timeout?: number;
}

export interface AIDecision {
  decision: 'continue' | 'accept' | 'reject' | 'counter';
  reasoning: string;
  confidence: number;
  nextAction?: {
    type: 'price_offer' | 'bundle_request' | 'quantity_offer' | 'walk_away';
    parameters: Record<string, any>;
  };
}

// Extension Settings Types
export interface ExtensionSettings {
  isEnabled: boolean;
  amazonPreferences: AmazonPreferences;
  notificationsEnabled: boolean;
  showStatsBadge: boolean;
  autoUpdateFilters: boolean;
}

// Amazon Search Enhancement Types
export interface AmazonPreferences {
  hideSponsored: boolean;
  primeOnly: boolean;
  minRating: number;
  minReviews: number;
  hideOutOfStock: boolean;
  preferAmazonShipping: boolean;
  blockedSellers: string[];
}

// Ads Blocking Types
export interface AdsBlockingStats {
  totalAdsBlocked: number;
  currentPageAdsBlocked: number;
  lastUpdated: Date;
}

export interface PageDisableSettings {
  [url: string]: {
    disabled: boolean;
    disabledAt: Date;
    reason?: string;
  };
}

// Statistics Types
export interface UserStats {
  totalSavings: number;
  dealsCompleted: number;
  activeNegotiations: number;
  successRate: number;
  averageDiscount: number;
  favoriteCategories: string[];
  lastUpdated: Date;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  successRate: number;
  averageNegotiationTime: number;
  totalSavings: number;
}

// UI Component Types
export interface DealCardProps {
  sessionId: string;
  productName: string;
  productImage: string;
  originalPrice: number;
  currentOffer: number;
  status: 'negotiating' | 'your_turn' | 'waiting_seller' | 'deal_ready';
  lastUpdate: Date;
  rounds: number;
  seller: string;
  onAction: (action: 'accept' | 'reject' | 'counter') => void;
}

export interface NotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: Array<{
    text: string;
    action: string;
    primary?: boolean;
  }>;
  autoClose?: number;
}

// Chrome Notification Types
export enum NotificationEvent {
  NEGOTIATION_STARTED = 'negotiation_started',
  OFFER_RECEIVED = 'offer_received', 
  DEAL_COMPLETED = 'deal_completed',
  NEGOTIATION_FAILED = 'negotiation_failed',
  PRICE_DROP_ALERT = 'price_drop_alert',
  SESSION_EXPIRED = 'session_expired',
  USER_ACTION_NEEDED = 'user_action_needed',
  SYSTEM_ERROR = 'system_error'
}

export interface ChromeNotificationTemplate {
  title: string;
  message: string;
  iconUrl: string;
  type: 'basic' | 'image' | 'list' | 'progress';
  buttons?: Array<{
    title: string;
    iconUrl?: string;
  }>;
  imageUrl?: string;
  items?: Array<{
    title: string;
    message: string;
  }>;
  progress?: number;
  contextMessage?: string;
  priority?: 0 | 1 | 2; // 0=min, 1=default, 2=high
  eventTime?: number;
  silent?: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  priority: 0 | 1 | 2;
  events: {
    [NotificationEvent.DEAL_COMPLETED]: boolean;
    [NotificationEvent.NEGOTIATION_FAILED]: boolean;
    [NotificationEvent.OFFER_RECEIVED]: boolean;
    [NotificationEvent.NEGOTIATION_STARTED]: boolean;
    [NotificationEvent.PRICE_DROP_ALERT]: boolean;
    [NotificationEvent.SESSION_EXPIRED]: boolean;
    [NotificationEvent.USER_ACTION_NEEDED]: boolean;
    [NotificationEvent.SYSTEM_ERROR]: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone?: string;
  };
  maxNotificationsPerHour: number;
  showBadges: boolean;
}

export interface NotificationHistory {
  id: string;
  event: NotificationEvent;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions: Array<{
    title: string;
    clicked: boolean;
    clickedAt?: Date;
  }>;
  sessionId?: string;
  productId?: string;
}

export interface NotificationContext {
  sessionId?: string;
  productId?: string;
  productName?: string;
  savings?: number;
  currency?: string;
  rounds?: number;
  sellerName?: string;
  errorCode?: string;
  additionalData?: Record<string, any>;
}

// Storage Types
export interface ProductView {
  productId: string;
  productInfo: ProductInfo;
  timestamp: Date;
  dwellTime?: number;
  interacted: boolean;
}

export interface SuccessfulDeal {
  sessionId: string;
  productInfo: ProductInfo;
  originalPrice: number;
  finalPrice: number;
  savings: number;
  timestamp: Date;
  negotiationRounds: number;
  seller: string;
}

// API Response Types
export interface DiscoveryResponse {
  sellers: SellerEndpoint[];
  total: number;
  query: Record<string, any>;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'up' | 'down';
    responseTime?: number;
    lastCheck: Date;
  }>;
}

// Error Types
export interface ExtensionError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  context?: {
    component: string;
    action: string;
    sessionId?: string;
    productId?: string;
  };
}

// Event Types
export interface ExtensionEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source: 'content' | 'background' | 'popup' | 'options';
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Constants
export const NEGOTIATION_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active', 
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export const DEAL_STATUS = {
  NEGOTIATING: 'negotiating',
  YOUR_TURN: 'your_turn',
  WAITING_SELLER: 'waiting_seller',
  DEAL_READY: 'deal_ready'
} as const;

export const MESSAGE_TYPES = {
  PRODUCT_VIEW: 'product_view',
  START_NEGOTIATION: 'start_negotiation',
  NEGOTIATION_STATUS: 'negotiation_status',
  DEAL_UPDATE: 'deal_update',
  STATS_UPDATE: 'stats_update',
  SETTINGS_UPDATE: 'settings_update'
} as const;

export type NegotiationStatus = typeof NEGOTIATION_STATUS[keyof typeof NEGOTIATION_STATUS];
export type DealStatus = typeof DEAL_STATUS[keyof typeof DEAL_STATUS];
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];