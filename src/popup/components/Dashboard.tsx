import React, { useState, useEffect } from 'react';
import { AdsBlockingStats } from '../../shared/types';

interface DashboardProps {
  isEnabled: boolean;
  activeNegotiations: number;
  totalSavings: number;
  onToggleEnabled: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  isEnabled,
  activeNegotiations,
  totalSavings,
  onToggleEnabled
}) => {
  const [adsStats, setAdsStats] = useState<AdsBlockingStats>({
    totalAdsBlocked: 0,
    currentPageAdsBlocked: 0,
    lastUpdated: new Date()
  });
  const [pageDisabled, setPageDisabled] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    loadAdsStats();
    loadPageStatus();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const loadAdsStats = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'get_ads_stats' }, (response) => {
          if (response?.success) {
            setAdsStats(response.stats);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load ads stats:', error);
    }
  };

  const loadPageStatus = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'get_page_status' }, (response) => {
          if (response?.success) {
            setPageDisabled(response.pageDisabled);
            setCurrentUrl(response.url);
          }
        });
      }
    } catch (error) {
      console.error('Failed to load page status:', error);
    }
  };

  const togglePageDisable = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'toggle_page_disable' }, (response) => {
          if (response?.success) {
            setPageDisabled(response.disabled);
            // Refresh stats after toggling
            setTimeout(loadAdsStats, 500);
          }
        });
      }
    } catch (error) {
      console.error('Failed to toggle page disable:', error);
    }
  };

  return (
    <div className="dashboard">
      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon savings">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-11h2v2h2v2h-2v2h2v2h-2v2h-2v-2H9v-2h2v-2H9v-2h2v-2z"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>Total Savings</h3>
            <p className="stat-value">{formatCurrency(totalSavings)}</p>
            <span className="stat-label">Lifetime savings</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>Active Deals</h3>
            <p className="stat-value">{activeNegotiations}</p>
            <span className="stat-label">In negotiation</span>
          </div>
        </div>
      </div>

      {/* Ads Blocking Stats */}
      <div className="ads-stats card mt-3">
        <h3>🛡️ Ads Blocking</h3>
        <div className="stats-row mt-2">
          <div className="stat-item">
            <span className="stat-number">{adsStats.currentPageAdsBlocked} </span>
            <span className="stat-label">ads blocked on this page</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{adsStats.totalAdsBlocked} </span>
            <span className="stat-label">total ads blocked</span>
          </div>
        </div>
        <button 
          className={`button ${pageDisabled ? 'primary' : 'secondary'} mt-2 w-full`}
          onClick={togglePageDisable}
        >
          {pageDisabled ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5L7 10.5 4.5 8l1-1L7 8.5l3.5-3.5 1 1z"/>
              </svg>
              Enable ads blocking on this page
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10 12H6V4h4v8z"/>
              </svg>
              Disable ads blocking on this page
            </>
          )}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions card mt-3">
        <h3>Quick Actions</h3>
        <div className="action-buttons mt-2">
          <button 
            className={`button ${isEnabled ? 'secondary' : ''}`}
            onClick={onToggleEnabled}
          >
            {isEnabled ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10 12H6V4h4v8z"/>
                </svg>
                Pause Assistant
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 12V4l6 4-6 4z"/>
                </svg>
                Enable Assistant
              </>
            )}
          </button>
          
          <button 
            className="button secondary"
            onClick={() => chrome.tabs.create({ url: 'https://www.amazon.com' })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13 2H3C2.45 2 2 2.45 2 3v10c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-1 10H4V4h8v8z"/>
            </svg>
            Open Amazon
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity card mt-3">
        <h3>Recent Activity</h3>
        <div className="activity-list mt-2">
          {activeNegotiations > 0 ? (
            <>
              <div className="activity-item">
                <div className="activity-icon negotiating">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12a5 5 0 110-10 5 5 0 010 10zm-.75-7h1.5v4h-1.5V6z"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <p>Negotiating Sony WH-1000XM4</p>
                  <span className="text-small text-muted">2 minutes ago</span>
                </div>
                <span className="activity-status">In Progress</span>
              </div>
              
              <div className="activity-item">
                <div className="activity-icon success">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5L7 10.5 4.5 8l1-1L7 8.5l3.5-3.5 1 1z"/>
                  </svg>
                </div>
                <div className="activity-content">
                  <p>Deal closed: Saved $45 on Echo Show</p>
                  <span className="text-small text-muted">1 hour ago</span>
                </div>
                <span className="activity-status success">Completed</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="text-muted">No recent activity</p>
              <p className="text-small text-muted mt-2">
                Browse Amazon products to start saving!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="tips card mt-3">
        <h3>💡 Pro Tip</h3>
        <p className="text-small mt-2">
          The AI Assistant works best when you browse products normally. 
          It will automatically detect your interest and negotiate the best deals!
        </p>
      </div>
    </div>
  );
};

