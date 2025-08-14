import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Dashboard } from './components/Dashboard';
import { ActiveDeals } from './components/ActiveDeals';
import { Settings } from './components/Settings';
import './popup.scss';

type View = 'dashboard' | 'deals' | 'settings';

interface AppState {
  isEnabled: boolean;
  activeNegotiations: number;
  totalSavings: number;
  currentView: View;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isEnabled: true,
    activeNegotiations: 0,
    totalSavings: 0,
    currentView: 'dashboard'
  });

  useEffect(() => {
    // Load state from storage
    chrome.storage.local.get(['isEnabled', 'stats'], (result) => {
      setState(prev => ({
        ...prev,
        isEnabled: result.isEnabled ?? true,
        activeNegotiations: result.stats?.activeNegotiations || 0,
        totalSavings: result.stats?.totalSavings || 0
      }));
    });

    // Listen for updates from background
    const handleMessage = (message: any) => {
      if (message.type === 'stats_update') {
        setState(prev => ({
          ...prev,
          activeNegotiations: message.data.activeNegotiations,
          totalSavings: message.data.totalSavings
        }));
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const toggleEnabled = async () => {
    const newState = !state.isEnabled;
    await chrome.storage.local.set({ isEnabled: newState });
    setState(prev => ({ ...prev, isEnabled: newState }));
    
    // Notify background script
    chrome.runtime.sendMessage({ 
      type: 'toggle_enabled', 
      enabled: newState 
    });
  };

  const renderView = () => {
    switch (state.currentView) {
      case 'dashboard':
        return (
          <Dashboard
            isEnabled={state.isEnabled}
            activeNegotiations={state.activeNegotiations}
            totalSavings={state.totalSavings}
            onToggleEnabled={toggleEnabled}
          />
        );
      case 'deals':
        return <ActiveDeals />;
      case 'settings':
        return <Settings />;
    }
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo">
          <img src="/icons/icon32.png" alt="AI Shopping Assistant" />
          <h1>AI Shopping Assistant</h1>
        </div>
        <div className="status-indicator">
          <span className={`status-dot ${state.isEnabled ? 'active' : 'inactive'}`} />
          <span className="status-text">
            {state.isEnabled ? 'Active' : 'Paused'}
          </span>
        </div>
      </header>

      <nav className="popup-nav">
        <button
          className={`nav-button ${state.currentView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, currentView: 'dashboard' }))}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1L2 6v9h5V10h2v5h5V6L8 1z"/>
          </svg>
          Dashboard
        </button>
        <button
          className={`nav-button ${state.currentView === 'deals' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, currentView: 'deals' }))}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h12v3H2zm0 5h12v7H2z"/>
          </svg>
          Active Deals
          {state.activeNegotiations > 0 && (
            <span className="badge">{state.activeNegotiations}</span>
          )}
        </button>
        <button
          className={`nav-button ${state.currentView === 'settings' ? 'active' : ''}`}
          onClick={() => setState(prev => ({ ...prev, currentView: 'settings' }))}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
            <path d="M9.796 1.343L8.343 0l-1.343 1.343L5.657 0 4.314 1.343 5.657 2.686 4.314 4.029l1.343 1.343L4.314 6.715 0 8l4.314 1.285L5.657 10.628l-1.343 1.343L5.657 13.314 4.314 14.657 5.657 16l1.343-1.343L8.343 16l1.453-1.343L11.139 16l1.343-1.343L11.139 13.314l1.343-1.343L11.139 10.628 16 8l-4.861-1.285 1.343-1.343-1.343-1.343 1.343-1.343L11.139 1.343 9.796 2.686 8.453 1.343z"/>
          </svg>
          Settings
        </button>
      </nav>

      <main className="popup-content">
        {renderView()}
      </main>

      <footer className="popup-footer">
        <a href="#" onClick={(e) => {
          e.preventDefault();
          chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
        }}>
          Full Settings
        </a>
        <span className="separator">•</span>
        <a href="#" onClick={(e) => {
          e.preventDefault();
          chrome.tabs.create({ url: 'https://help.example.com' });
        }}>
          Help
        </a>
      </footer>
    </div>
  );
};

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);