// Session State Management - Handles persistent negotiation sessions
export interface NegotiationSession {
  sessionId: string;
  productId: string;
  productInfo: {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    seller: string;
    url: string;
  };
  behavior: {
    interestScore: number;
    dwellTime: number;
    priceChecks: number;
    addToCartAttempts: number;
  };
  preferences?: {
    desiredDiscount: number;
    maxPrice: number;
    options: {
      openToBundle: boolean;
      interestedInWarranty: boolean;
      willingToBuyMultiple: boolean;
      flexiblePayment: boolean;
    };
    strategy: 'aggressive' | 'balanced' | 'conservative' | 'custom';
    customRequirements?: string;
  };
  status: 'pending' | 'active' | 'completed' | 'failed';
  sellerEndpoint?: string;
  currentOffer?: any;
  negotiationLog: NegotiationStep[];
  startTime: Date;
  lastUpdate: Date;
  expiresAt: Date;
}

export interface NegotiationStep {
  round: number;
  action: 'analyze' | 'offer' | 'counter' | 'accept' | 'reject';
  details: any;
  timestamp: Date;
  reasoning?: string;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  successRate: number;
  averageNegotiationTime: number;
  totalSavings: number;
}

export class SessionManager {
  private readonly DB_NAME = 'AI_Shopping_Sessions';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'sessions';
  private readonly STATS_STORE = 'stats';
  private db: IDBDatabase | null = null;

  constructor() {
    this.initializeDB();
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ Failed to initialize session database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Session database initialized');
        
        // Setup error handler
        this.db.onerror = (event) => {
          console.error('Database error:', event);
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create sessions store
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const sessionStore = db.createObjectStore(this.STORE_NAME, {
            keyPath: 'sessionId'
          });

          // Create indices for efficient queries
          sessionStore.createIndex('status', 'status');
          sessionStore.createIndex('productId', 'productId');
          sessionStore.createIndex('startTime', 'startTime');
          sessionStore.createIndex('expiresAt', 'expiresAt');
          sessionStore.createIndex('lastUpdate', 'lastUpdate');

          console.log('📦 Created sessions object store with indices');
        }

        // Create stats store
        if (!db.objectStoreNames.contains(this.STATS_STORE)) {
          const statsStore = db.createObjectStore(this.STATS_STORE, {
            keyPath: 'id'
          });

          console.log('📊 Created stats object store');
        }
      };
    });
  }

  async saveSession(session: NegotiationSession): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);

      // Ensure dates are properly serialized
      const sessionToSave = {
        ...session,
        startTime: session.startTime,
        lastUpdate: session.lastUpdate,
        expiresAt: session.expiresAt,
        negotiationLog: session.negotiationLog.map(step => ({
          ...step,
          timestamp: step.timestamp
        }))
      };

      const request = store.put(sessionToSave);

      request.onsuccess = () => {
        console.log('💾 Session saved:', session.sessionId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to save session:', request.error);
        reject(request.error);
      };
    });
  }

  async getSession(sessionId: string): Promise<NegotiationSession | null> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(sessionId);

      request.onsuccess = () => {
        const session = request.result;
        if (session) {
          // Restore Date objects
          session.startTime = new Date(session.startTime);
          session.lastUpdate = new Date(session.lastUpdate);
          session.expiresAt = new Date(session.expiresAt);
          session.negotiationLog = session.negotiationLog.map((step: any) => ({
            ...step,
            timestamp: new Date(step.timestamp)
          }));
          
          resolve(session);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to get session:', request.error);
        reject(request.error);
      };
    });
  }

  async getActiveSessions(): Promise<NegotiationSession[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('status');
      
      // Get sessions with 'active' or 'pending' status
      const activeRequest = index.getAll('active');
      const pendingRequest = index.getAll('pending');

      let activeResults: NegotiationSession[] = [];
      let pendingResults: NegotiationSession[] = [];
      let completedRequests = 0;

      const checkComplete = () => {
        if (completedRequests === 2) {
          const allSessions = [...activeResults, ...pendingResults];
          
          // Restore Date objects and filter expired sessions
          const validSessions = allSessions
            .map(session => ({
              ...session,
              startTime: new Date(session.startTime),
              lastUpdate: new Date(session.lastUpdate),
              expiresAt: new Date(session.expiresAt),
              negotiationLog: session.negotiationLog.map((step: any) => ({
                ...step,
                timestamp: new Date(step.timestamp)
              }))
            }))
            .filter(session => session.expiresAt > new Date());

          resolve(validSessions);
        }
      };

      activeRequest.onsuccess = () => {
        activeResults = activeRequest.result || [];
        completedRequests++;
        checkComplete();
      };

      pendingRequest.onsuccess = () => {
        pendingResults = pendingRequest.result || [];
        completedRequests++;
        checkComplete();
      };

      activeRequest.onerror = pendingRequest.onerror = () => {
        console.error('❌ Failed to get active sessions:', activeRequest.error || pendingRequest.error);
        reject(activeRequest.error || pendingRequest.error);
      };
    });
  }

  async getSessionsByProduct(productId: string): Promise<NegotiationSession[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('productId');
      const request = index.getAll(productId);

      request.onsuccess = () => {
        const sessions = (request.result || []).map(session => ({
          ...session,
          startTime: new Date(session.startTime),
          lastUpdate: new Date(session.lastUpdate),
          expiresAt: new Date(session.expiresAt),
          negotiationLog: session.negotiationLog.map((step: any) => ({
            ...step,
            timestamp: new Date(step.timestamp)
          }))
        }));

        resolve(sessions);
      };

      request.onerror = () => {
        console.error('❌ Failed to get sessions by product:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(sessionId);

      request.onsuccess = () => {
        console.log('🗑️ Session deleted:', sessionId);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to delete session:', request.error);
        reject(request.error);
      };
    });
  }

  async cleanupExpiredSessions(): Promise<number> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('expiresAt');
      
      const now = new Date();
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);
      
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          // Delete expired session
          const deleteRequest = cursor.delete();
          
          deleteRequest.onsuccess = () => {
            deletedCount++;
            console.log('🧹 Deleted expired session:', cursor.value.sessionId);
          };
          
          cursor.continue();
        } else {
          console.log(`🧹 Cleanup completed: ${deletedCount} sessions removed`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('❌ Failed to cleanup expired sessions:', request.error);
        reject(request.error);
      };
    });
  }

  async updateSessionStatus(sessionId: string, status: NegotiationSession['status'], additionalData?: Partial<NegotiationSession>): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = status;
    session.lastUpdate = new Date();
    
    // Apply additional updates
    if (additionalData) {
      Object.assign(session, additionalData);
    }

    await this.saveSession(session);
  }

  async addNegotiationStep(sessionId: string, step: NegotiationStep): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.negotiationLog.push(step);
    session.lastUpdate = new Date();
    
    await this.saveSession(session);
  }

  async getSessionStats(): Promise<SessionStats> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions: NegotiationSession[] = request.result || [];
        
        const now = new Date();
        const validSessions = sessions.filter(s => new Date(s.expiresAt) > now);
        
        const activeSessions = validSessions.filter(s => s.status === 'active' || s.status === 'pending');
        const completedSessions = validSessions.filter(s => s.status === 'completed');
        
        // Calculate average negotiation time
        const completedWithTime = completedSessions.filter(s => s.startTime && s.lastUpdate);
        const totalTime = completedWithTime.reduce((sum, session) => {
          const duration = new Date(session.lastUpdate).getTime() - new Date(session.startTime).getTime();
          return sum + duration;
        }, 0);
        
        const averageTime = completedWithTime.length > 0 ? totalTime / completedWithTime.length : 0;
        
        // Calculate total savings
        const totalSavings = completedSessions.reduce((sum, session) => {
          if (session.currentOffer && session.productInfo.price) {
            const savings = session.productInfo.price - session.currentOffer.price;
            return sum + (savings > 0 ? savings : 0);
          }
          return sum;
        }, 0);

        const stats: SessionStats = {
          totalSessions: validSessions.length,
          activeSessions: activeSessions.length,
          completedSessions: completedSessions.length,
          successRate: validSessions.length > 0 ? completedSessions.length / validSessions.length : 0,
          averageNegotiationTime: averageTime,
          totalSavings
        };

        resolve(stats);
      };

      request.onerror = () => {
        console.error('❌ Failed to get session stats:', request.error);
        reject(request.error);
      };
    });
  }

  async saveStats(stats: Partial<SessionStats>): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STATS_STORE], 'readwrite');
      const store = transaction.objectStore(this.STATS_STORE);
      
      const statsRecord = {
        id: 'global',
        ...stats,
        lastUpdated: new Date()
      };

      const request = store.put(statsRecord);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to save stats:', request.error);
        reject(request.error);
      };
    });
  }

  async exportSessions(): Promise<NegotiationSession[]> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const sessions = (request.result || []).map(session => ({
          ...session,
          startTime: new Date(session.startTime),
          lastUpdate: new Date(session.lastUpdate),
          expiresAt: new Date(session.expiresAt),
          negotiationLog: session.negotiationLog.map((step: any) => ({
            ...step,
            timestamp: new Date(step.timestamp)
          }))
        }));

        resolve(sessions);
      };

      request.onerror = () => {
        console.error('❌ Failed to export sessions:', request.error);
        reject(request.error);
      };
    });
  }

  async importSessions(sessions: NegotiationSession[]): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    for (const session of sessions) {
      store.put(session);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(`📥 Imported ${sessions.length} sessions`);
        resolve();
      };

      transaction.onerror = () => {
        console.error('❌ Failed to import sessions:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  async clearAllSessions(): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 All sessions cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Failed to clear sessions:', request.error);
        reject(request.error);
      };
    });
  }

  // Helper method to create a new session
  createSession(
    sessionId: string,
    productInfo: NegotiationSession['productInfo'],
    behavior: NegotiationSession['behavior']
  ): NegotiationSession {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    return {
      sessionId,
      productId: productInfo.id,
      productInfo,
      behavior,
      status: 'pending',
      negotiationLog: [],
      startTime: now,
      lastUpdate: now,
      expiresAt
    };
  }
}