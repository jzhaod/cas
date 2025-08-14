import React, { useState, useEffect } from 'react';

interface Deal {
  sessionId: string;
  productId: string;
  productName: string;
  productImage: string;
  productUrl: string;
  originalPrice: number;
  currentOffer: number;
  status: 'negotiating' | 'your_turn' | 'waiting_seller' | 'deal_ready';
  lastUpdate: Date;
  rounds: number;
  seller: string;
}

export const ActiveDeals: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveDeals();

    // Listen for real-time updates
    const handleMessage = (message: any) => {
      if (message.type === 'deal_update') {
        loadActiveDeals();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const loadActiveDeals = async () => {
    try {
      // Request active deals from background script
      const response = await chrome.runtime.sendMessage({ 
        type: 'get_active_deals' 
      });
      
      setDeals(response.deals || []);
    } catch (error) {
      console.error('Failed to load deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDealAction = async (sessionId: string, action: 'accept' | 'reject' | 'counter') => {
    // Prevent multiple clicks by disabling the button temporarily
    const buttons = document.querySelectorAll(`[data-session="${sessionId}"] button`);
    buttons.forEach(btn => (btn as HTMLButtonElement).disabled = true);

    try {
      if (action === 'accept') {
        // Send accept message to background
        await chrome.runtime.sendMessage({
          type: 'accept_deal',
          sessionId
        });
        
        // Find the deal to get product URL
        const currentDeal = deals.find(d => d.sessionId === sessionId);
        if (currentDeal) {
          // Close popup and redirect to product page for purchase
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.update(tabs[0].id, { 
                url: currentDeal.productUrl // Use the actual product URL
              });
              window.close(); // Close popup
            }
          });
        }
      } else {
        await chrome.runtime.sendMessage({
          type: 'deal_action',
          sessionId,
          action
        });
      }
      
      // Reload deals
      loadActiveDeals();
    } catch (error) {
      console.error('Deal action failed:', error);
      // Re-enable buttons on error
      buttons.forEach(btn => (btn as HTMLButtonElement).disabled = false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusIcon = (status: Deal['status']) => {
    switch (status) {
      case 'negotiating':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="animate-pulse">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12a5 5 0 110-10 5 5 0 010 10z"/>
            <circle cx="8" cy="8" r="2" />
          </svg>
        );
      case 'your_turn':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm1 11H7V7h2v5zm0-6H7V4h2v2z"/>
          </svg>
        );
      case 'waiting_seller':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12a5 5 0 110-10 5 5 0 010 10zm-.75-7h1.5v4h-1.5V6z"/>
          </svg>
        );
      case 'deal_ready':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5L7 10.5 4.5 8l1-1L7 8.5l3.5-3.5 1 1z"/>
          </svg>
        );
    }
  };

  const getStatusText = (status: Deal['status']) => {
    switch (status) {
      case 'negotiating': return 'AI Negotiating';
      case 'your_turn': return 'Your Approval Needed';
      case 'waiting_seller': return 'Waiting for Seller';
      case 'deal_ready': return 'Deal Ready!';
    }
  };

  const getTimeAgo = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!dateObj || isNaN(dateObj.getTime())) return 'Unknown';
    
    const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading active deals...</p>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="empty-deals">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.1">
          <path d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 44c-11.028 0-20-8.972-20-20s8.972-20 20-20 20 8.972 20 20-8.972 20-20 20z"/>
          <path d="M32 20c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 20c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8z"/>
        </svg>
        <h3>No Active Negotiations</h3>
        <p className="text-muted">Browse Amazon products and your AI assistant will start negotiating deals for you!</p>
        <button 
          className="button mt-3"
          onClick={() => chrome.tabs.create({ url: 'https://www.amazon.com' })}
        >
          Browse Amazon
        </button>
      </div>
    );
  }

  return (
    <div className="active-deals">
      <div className="deals-header">
        <h2>Active Negotiations ({deals.length})</h2>
        <button className="button small secondary" onClick={loadActiveDeals}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M7 1v6l4-4-4-2zm0 12V7l-4 4 4 2z"/>
          </svg>
          Refresh
        </button>
      </div>

      <div className="deals-list">
        {deals.map(deal => (
          <div key={deal.sessionId} className="deal-card card" data-session={deal.sessionId}>
            <div className="deal-header">
              <img src={deal.productImage} alt={deal.productName} className="product-image" />
              <div className="deal-info">
                <h4>{deal.productName}</h4>
                <p className="seller-name text-small text-muted">Seller: {deal.seller}</p>
                <div className="price-info">
                  <span className="original-price">{formatCurrency(deal.originalPrice)}</span>
                  <span className="arrow">→</span>
                  <span className="offer-price">{formatCurrency(deal.currentOffer)}</span>
                  <span className="savings">Save {formatCurrency(deal.originalPrice - deal.currentOffer)}</span>
                </div>
              </div>
            </div>

            <div className="deal-status">
              <div className="status-badge" data-status={deal.status}>
                {getStatusIcon(deal.status)}
                <span>{getStatusText(deal.status)}</span>
              </div>
              <div className="deal-meta">
                <span className="text-small text-muted">Round {deal.rounds}</span>
                <span className="text-small text-muted">•</span>
                <span className="text-small text-muted">{getTimeAgo(deal.lastUpdate)}</span>
              </div>
            </div>

            {deal.status === 'your_turn' && (
              <div className="deal-actions">
                <p className="action-prompt">The seller offered {formatCurrency(deal.currentOffer)}. What would you like to do?</p>
                <div className="action-buttons">
                  <button 
                    className="button small"
                    onClick={() => handleDealAction(deal.sessionId, 'accept')}
                  >
                    Accept Deal
                  </button>
                  <button 
                    className="button small secondary"
                    onClick={() => handleDealAction(deal.sessionId, 'counter')}
                  >
                    Counter Offer
                  </button>
                  <button 
                    className="button small secondary"
                    onClick={() => handleDealAction(deal.sessionId, 'reject')}
                  >
                    Walk Away
                  </button>
                </div>
              </div>
            )}

            {deal.status === 'deal_ready' && (
              <div className="deal-actions">
                <p className="action-prompt success">🎉 Deal accepted! Click below to complete your purchase.</p>
                <button 
                  className="button"
                  onClick={() => chrome.runtime.sendMessage({
                    type: 'complete_purchase',
                    sessionId: deal.sessionId
                  })}
                >
                  Complete Purchase
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

