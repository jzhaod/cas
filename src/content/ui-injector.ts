// UI injection for Amazon pages - manages floating elements and notifications
import { ProductInfo } from './product-detector';

export type NegotiationStatus = 'idle' | 'starting' | 'negotiating' | 'deal_found' | 'completed' | 'failed';

export class UIInjector {
  private shadowRoot: ShadowRoot | null = null;
  private floatingBadge: HTMLElement | null = null;
  private notificationContainer: HTMLElement | null = null;
  private currentStatus: NegotiationStatus = 'idle';

  constructor() {
    this.initializeShadowDOM();
    this.injectStyles();
    this.setupMessageListener();
  }

  private initializeShadowDOM() {
    // Create shadow host for isolated styling
    const shadowHost = document.createElement('div');
    shadowHost.id = 'ai-shopping-assistant-ui';
    shadowHost.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 0;
      height: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;

    this.shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
    document.documentElement.appendChild(shadowHost);
  }

  private injectStyles() {
    if (!this.shadowRoot) return;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .floating-badge {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 24px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        pointer-events: auto;
        transform: translateX(100%);
        transition: all 0.3s ease;
        box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .floating-badge.visible {
        transform: translateX(0);
      }

      .floating-badge:hover {
        transform: translateX(0) scale(1.05);
        box-shadow: 0 6px 30px rgba(102, 126, 234, 0.4);
      }

      .badge-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .badge-icon.robot {
        animation: bounce 2s infinite;
      }

      .badge-icon.pulse {
        animation: pulse 1.5s infinite;
      }

      .badge-icon.success {
        animation: celebrate 0.6s ease-out;
      }

      .badge-text {
        white-space: nowrap;
      }

      .notification-container {
        position: fixed !important;
        top: 80px !important;
        right: 20px !important;
        max-width: 400px !important;
        min-width: 320px !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .notification {
        background: white !important;
        border-radius: 12px !important;
        padding: 20px !important;
        margin-bottom: 12px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
        border: 1px solid rgba(0, 0, 0, 0.08) !important;
        pointer-events: auto !important;
        transform: translateX(100%) !important;
        transition: all 0.3s ease !important;
        backdrop-filter: blur(10px) !important;
        width: 100% !important;
        min-height: 120px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        color: #333 !important;
        box-sizing: border-box !important;
      }

      .notification.visible {
        transform: translateX(0) !important;
      }

      .notification-header {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 8px !important;
      }

      .notification-icon {
        width: 24px !important;
        height: 24px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 16px !important;
      }

      .notification-icon.info {
        background: #e0f2fe !important;
        color: #0277bd !important;
      }

      .notification-icon.success {
        background: #e8f5e8 !important;
        color: #2e7d32 !important;
      }

      .notification-icon.warning {
        background: #fff3e0 !important;
        color: #f57c00 !important;
      }

      .notification-title {
        font-weight: 600 !important;
        color: #1a1a1a !important;
        font-size: 16px !important;
        margin: 0 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .notification-message {
        color: #444 !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
        margin-bottom: 16px !important;
        word-wrap: break-word !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .notification-actions {
        display: flex !important;
        gap: 12px !important;
        justify-content: flex-end !important;
      }

      .btn {
        padding: 10px 20px !important;
        border-radius: 8px !important;
        border: none !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        text-align: center !important;
        min-width: 80px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        text-decoration: none !important;
        display: inline-block !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
      }

      .btn-primary {
        background: #667eea !important;
        color: white !important;
      }

      .btn-primary:hover {
        background: #5a67d8 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
      }

      .btn-secondary {
        background: #f1f5f9 !important;
        color: #64748b !important;
        border: 1px solid #d1d5db !important;
      }

      .btn-secondary:hover {
        background: #e2e8f0 !important;
        color: #475569 !important;
        border-color: #9ca3af !important;
      }

      .progress-bar {
        width: 100%;
        height: 3px;
        background: #f1f5f9;
        border-radius: 2px;
        overflow: hidden;
        margin-top: 12px;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 2px;
        transition: width 0.3s ease;
        animation: progress-flow 2s infinite linear;
      }

      @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-3px); }
        60% { transform: translateY(-2px); }
      }

      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes celebrate {
        0% { transform: scale(1) rotate(0deg); }
        25% { transform: scale(1.2) rotate(-5deg); }
        50% { transform: scale(1.3) rotate(5deg); }
        75% { transform: scale(1.1) rotate(-2deg); }
        100% { transform: scale(1) rotate(0deg); }
      }

      @keyframes progress-flow {
        0% { background-position: -200px 0; }
        100% { background-position: calc(200px + 100%) 0; }
      }

      .fade-out {
        opacity: 0;
        transform: translateX(100%);
      }

      /* Negotiation Preferences Modal Styles */
      .preferences-modal {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) scale(0.9) !important;
        background: white !important;
        border-radius: 16px !important;
        padding: 24px !important;
        width: 90% !important;
        max-width: 500px !important;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
        border: 1px solid rgba(0, 0, 0, 0.1) !important;
        z-index: 2147483647 !important;
        opacity: 0 !important;
        pointer-events: auto !important;
        transition: all 0.3s ease !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .preferences-modal.visible {
        opacity: 1 !important;
        transform: translate(-50%, -50%) scale(1) !important;
      }

      .modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        z-index: 2147483646 !important;
        opacity: 0 !important;
        pointer-events: auto !important;
        transition: opacity 0.3s ease !important;
      }

      .modal-overlay.visible {
        opacity: 1 !important;
      }

      .modal-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        margin-bottom: 20px !important;
        padding-bottom: 16px !important;
        border-bottom: 1px solid #e5e7eb !important;
      }

      .modal-title {
        font-size: 20px !important;
        font-weight: 600 !important;
        color: #1a1a1a !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      .modal-close {
        width: 32px !important;
        height: 32px !important;
        border-radius: 50% !important;
        background: #f3f4f6 !important;
        border: none !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        font-size: 18px !important;
        color: #6b7280 !important;
      }

      .modal-close:hover {
        background: #e5e7eb !important;
        color: #374151 !important;
      }

      .preferences-form {
        display: flex !important;
        flex-direction: column !important;
        gap: 20px !important;
      }

      .form-group {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
      }

      .form-label {
        font-size: 14px !important;
        font-weight: 500 !important;
        color: #374151 !important;
      }

      .form-input {
        padding: 10px 12px !important;
        border: 1px solid #d1d5db !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        transition: all 0.2s ease !important;
        background: white !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .form-input:focus {
        outline: none !important;
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
      }

      .form-slider {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
      }

      .slider {
        flex: 1 !important;
        -webkit-appearance: none !important;
        appearance: none !important;
        height: 6px !important;
        border-radius: 3px !important;
        background: #e5e7eb !important;
        outline: none !important;
        transition: background 0.2s !important;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none !important;
        appearance: none !important;
        width: 20px !important;
        height: 20px !important;
        border-radius: 50% !important;
        background: #667eea !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }

      .slider::-webkit-slider-thumb:hover {
        transform: scale(1.2) !important;
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3) !important;
      }

      .slider-value {
        min-width: 45px !important;
        text-align: center !important;
        font-weight: 500 !important;
        color: #667eea !important;
      }

      .checkbox-group {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 12px !important;
      }

      .checkbox-item {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        cursor: pointer !important;
        user-select: none !important;
      }

      .checkbox-input {
        width: 18px !important;
        height: 18px !important;
        cursor: pointer !important;
      }

      .checkbox-label {
        font-size: 14px !important;
        color: #4b5563 !important;
        cursor: pointer !important;
      }

      .form-textarea {
        padding: 10px 12px !important;
        border: 1px solid #d1d5db !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        min-height: 80px !important;
        resize: vertical !important;
        transition: all 0.2s ease !important;
        background: white !important;
        color: #1a1a1a !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .form-textarea:focus {
        outline: none !important;
        border-color: #667eea !important;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
      }

      .modal-footer {
        display: flex !important;
        justify-content: flex-end !important;
        gap: 12px !important;
        margin-top: 24px !important;
        padding-top: 20px !important;
        border-top: 1px solid #e5e7eb !important;
      }

      .help-text {
        font-size: 12px !important;
        color: #6b7280 !important;
        font-style: italic !important;
      }
    `;

    this.shadowRoot.appendChild(styleSheet);
  }

  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'negotiation_status':
          this.updateNegotiationStatus(message.status, message.data);
          break;
        case 'show_deal_notification':
          this.showDealNotification(message.deal);
          break;
        case 'hide_ui':
          this.cleanup();
          break;
      }
    });
  }

  showFloatingBadge(productInfo: ProductInfo) {
    if (!this.shadowRoot) return;

    this.cleanup(); // Remove existing UI

    // Create floating badge
    this.floatingBadge = document.createElement('div');
    this.floatingBadge.className = 'floating-badge';
    this.floatingBadge.innerHTML = `
      <div class="badge-icon robot">
        🤖
      </div>
      <span class="badge-text">AI Assistant Active</span>
    `;

    // Add click handler
    this.floatingBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🖱️ Floating badge clicked, showing product dialog');
      this.showProductDialog(productInfo);
    });

    this.shadowRoot.appendChild(this.floatingBadge);

    // Animate in
    setTimeout(() => {
      this.floatingBadge?.classList.add('visible');
    }, 100);
  }

  showNegotiationStatus(status: NegotiationStatus, data?: any) {
    this.currentStatus = status;
    
    if (!this.floatingBadge || !this.shadowRoot) return;

    const icon = this.floatingBadge.querySelector('.badge-icon');
    const text = this.floatingBadge.querySelector('.badge-text');

    if (!icon || !text) return;

    // Update badge based on status
    switch (status) {
      case 'starting':
        icon.className = 'badge-icon pulse';
        icon.textContent = '⚡';
        text.textContent = 'Starting negotiation...';
        break;
      
      case 'negotiating':
        icon.className = 'badge-icon pulse';
        icon.textContent = '💬';
        text.textContent = `Negotiating... (Round ${data?.round || 1})`;
        break;
      
      case 'deal_found':
        icon.className = 'badge-icon success';
        icon.textContent = '🎉';
        text.textContent = `Deal found! Save $${data?.savings || 0}`;
        this.showDealNotification(data);
        break;
      
      case 'completed':
        icon.className = 'badge-icon success';
        icon.textContent = '✅';
        text.textContent = 'Deal completed!';
        setTimeout(() => this.fadeOut(), 3000);
        break;
      
      case 'failed':
        icon.className = 'badge-icon';
        icon.textContent = '😞';
        text.textContent = 'No deal available';
        setTimeout(() => this.fadeOut(), 5000);
        break;
      
      default:
        icon.className = 'badge-icon robot';
        icon.textContent = '🤖';
        text.textContent = 'AI Assistant Active';
    }
  }

  private showProductDialog(productInfo: ProductInfo) {
    console.log('🔍 Showing product dialog for:', productInfo);
    
    if (!this.shadowRoot) {
      console.warn('❌ No shadow root available for product dialog');
      return;
    }

    // Create notification container if it doesn't exist
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.className = 'notification-container';
      this.shadowRoot.appendChild(this.notificationContainer);
    }

    const dialog = document.createElement('div');
    dialog.className = 'notification';
    
    // Safely display product info with fallbacks
    const productName = productInfo?.name || 'Amazon Product';
    const productPrice = productInfo?.price ? `${productInfo.currency || '$'}${productInfo.price}` : 'Price not detected';
    
    dialog.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon info">🛍️</div>
        <div class="notification-title">AI Assistant Active</div>
      </div>
      <div class="notification-message">
        <strong>${productName}</strong><br>
        Price: ${productPrice}<br>
        <small>AI Assistant is monitoring this product for deal opportunities and price negotiations.</small>
      </div>
      <div class="notification-actions">
        <button class="btn btn-secondary" data-action="got-it">
          Got it
        </button>
        <button class="btn btn-primary" data-action="start-negotiation">
          Start Negotiation
        </button>
      </div>
    `;

    // Add event listeners
    dialog.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      console.log('🖱️ Dialog action clicked:', action);
      
      switch (action) {
        case 'got-it':
          dialog.classList.add('fade-out');
          setTimeout(() => dialog.remove(), 300);
          break;
        case 'start-negotiation':
          this.startNegotiationManually(productInfo);
          dialog.classList.add('fade-out');
          setTimeout(() => dialog.remove(), 300);
          break;
      }
    });

    this.notificationContainer.appendChild(dialog);

    // Animate in
    setTimeout(() => {
      dialog.classList.add('visible');
      console.log('✅ Product dialog animated in');
    }, 100);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (dialog.parentNode) {
        dialog.classList.add('fade-out');
        setTimeout(() => dialog.remove(), 300);
      }
    }, 10000);
  }

  private startNegotiationManually(productInfo: ProductInfo) {
    console.log('🚀 Showing negotiation preferences for:', productInfo.id);
    
    // Show preferences modal instead of starting negotiation immediately
    this.showNegotiationPreferencesModal(productInfo);
  }

  private showNegotiationPreferencesModal(productInfo: ProductInfo) {
    if (!this.shadowRoot) {
      console.warn('❌ No shadow root available for preferences modal');
      return;
    }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'preferences-modal';
    
    modal.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">
          💬 Set Your Negotiation Preferences
        </div>
        <button class="modal-close" data-action="close">✕</button>
      </div>
      
      <form class="preferences-form">
        <div class="form-group">
          <label class="form-label">Desired Discount (%)</label>
          <div class="form-slider">
            <input type="range" class="slider" id="discount-slider" min="5" max="50" value="20" step="5">
            <span class="slider-value" id="discount-value">20%</span>
          </div>
          <span class="help-text">How much discount would you like to negotiate for?</span>
        </div>

        <div class="form-group">
          <label class="form-label">Maximum Price You're Willing to Pay</label>
          <input type="number" class="form-input" id="max-price" 
                 placeholder="Enter amount" 
                 value="${Math.round(productInfo.price * 0.85)}"
                 min="0" step="0.01">
          <span class="help-text">Current price: ${productInfo.currency || '$'}${productInfo.price}</span>
        </div>

        <div class="form-group">
          <label class="form-label">Negotiation Options</label>
          <div class="checkbox-group">
            <label class="checkbox-item">
              <input type="checkbox" class="checkbox-input" id="bundle-option" checked>
              <span class="checkbox-label">Open to bundle deals</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="checkbox-input" id="warranty-option">
              <span class="checkbox-label">Interested in extended warranty</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="checkbox-input" id="bulk-option">
              <span class="checkbox-label">Willing to buy multiple items</span>
            </label>
            <label class="checkbox-item">
              <input type="checkbox" class="checkbox-input" id="payment-option">
              <span class="checkbox-label">Flexible on payment terms</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Negotiation Strategy</label>
          <select class="form-input" id="strategy-select">
            <option value="aggressive">Aggressive - Push for maximum discount</option>
            <option value="balanced" selected>Balanced - Fair negotiation for both parties</option>
            <option value="conservative">Conservative - Small discount is fine</option>
            <option value="custom">Custom - Use my specific requirements</option>
          </select>
        </div>

        <div class="form-group" id="custom-requirements" style="display: none;">
          <label class="form-label">Custom Requirements</label>
          <textarea class="form-textarea" id="custom-text" 
                    placeholder="E.g., I need free shipping, prefer 2-year warranty, looking for a discount if I buy 2 units..."></textarea>
        </div>
      </form>

      <div class="modal-footer">
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="start">Start Negotiation</button>
      </div>
    `;

    // Add to shadow root
    this.shadowRoot.appendChild(overlay);
    this.shadowRoot.appendChild(modal);

    // Setup event listeners
    const discountSlider = modal.querySelector('#discount-slider') as HTMLInputElement;
    const discountValue = modal.querySelector('#discount-value') as HTMLSpanElement;
    const strategySelect = modal.querySelector('#strategy-select') as HTMLSelectElement;
    const customRequirements = modal.querySelector('#custom-requirements') as HTMLDivElement;
    
    // Update discount display
    discountSlider?.addEventListener('input', () => {
      if (discountValue) {
        discountValue.textContent = `${discountSlider.value}%`;
      }
    });

    // Show/hide custom requirements
    strategySelect?.addEventListener('change', () => {
      if (customRequirements) {
        customRequirements.style.display = strategySelect.value === 'custom' ? 'block' : 'none';
      }
    });

    // Handle modal actions
    modal.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      if (action === 'close' || action === 'cancel') {
        this.closeModal(overlay, modal);
      } else if (action === 'start') {
        const preferences = this.collectNegotiationPreferences(modal);
        this.closeModal(overlay, modal);
        this.startNegotiationWithPreferences(productInfo, preferences);
      }
    });

    // Click overlay to close
    overlay.addEventListener('click', () => {
      this.closeModal(overlay, modal);
    });

    // Animate in
    setTimeout(() => {
      overlay.classList.add('visible');
      modal.classList.add('visible');
    }, 10);
  }

  private collectNegotiationPreferences(modal: HTMLElement): any {
    const discountSlider = modal.querySelector('#discount-slider') as HTMLInputElement;
    const maxPrice = modal.querySelector('#max-price') as HTMLInputElement;
    const bundleOption = modal.querySelector('#bundle-option') as HTMLInputElement;
    const warrantyOption = modal.querySelector('#warranty-option') as HTMLInputElement;
    const bulkOption = modal.querySelector('#bulk-option') as HTMLInputElement;
    const paymentOption = modal.querySelector('#payment-option') as HTMLInputElement;
    const strategySelect = modal.querySelector('#strategy-select') as HTMLSelectElement;
    const customText = modal.querySelector('#custom-text') as HTMLTextAreaElement;

    return {
      desiredDiscount: parseInt(discountSlider?.value || '20'),
      maxPrice: parseFloat(maxPrice?.value || '0'),
      options: {
        openToBundle: bundleOption?.checked || false,
        interestedInWarranty: warrantyOption?.checked || false,
        willingToBuyMultiple: bulkOption?.checked || false,
        flexiblePayment: paymentOption?.checked || false
      },
      strategy: strategySelect?.value || 'balanced',
      customRequirements: strategySelect?.value === 'custom' ? (customText?.value || '') : ''
    };
  }

  private closeModal(overlay: HTMLElement, modal: HTMLElement) {
    overlay.classList.remove('visible');
    modal.classList.remove('visible');
    
    setTimeout(() => {
      overlay.remove();
      modal.remove();
    }, 300);
  }

  private startNegotiationWithPreferences(productInfo: ProductInfo, preferences: any) {
    console.log('🚀 Starting negotiation with preferences:', preferences);
    
    // Create behavior object for manual negotiations with preferences
    const behavior = {
      productId: productInfo.id,
      dwellTime: 0, // Manual start, so no tracked dwell time
      interactions: ['manual_start'],
      priceChecks: 1, // User manually initiated, so they're interested in price
      addToCartAttempts: 0,
      wishlistAdds: 0,
      interestScore: 0.8, // High interest since manually started
      timestamp: new Date()
    };
    
    // Show negotiation starting status immediately
    this.showNegotiationStatus('starting');
    
    // Notify background script to start negotiation with preferences
    chrome.runtime.sendMessage({
      type: 'start_negotiation',
      productId: productInfo.id,
      productInfo: productInfo,
      behavior: behavior,
      preferences: preferences, // Include user preferences
      manual: true,
      url: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to send negotiation message:', chrome.runtime.lastError);
        this.showNegotiationStatus('failed', { error: 'Connection failed' });
      } else if (response && response.success) {
        console.log('✅ Negotiation started with preferences, session ID:', response.sessionId);
        // Status updates will come via background script messages
      } else {
        console.error('❌ Negotiation failed to start:', response);
        this.showNegotiationStatus('failed', { error: 'Failed to start' });
      }
    });
  }

  showDealNotification(deal: any) {
    if (!this.shadowRoot) return;

    // Create notification container if it doesn't exist
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.className = 'notification-container';
      this.shadowRoot.appendChild(this.notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon success">💰</div>
        <div class="notification-title">Deal Found!</div>
      </div>
      <div class="notification-message">
        Your AI negotiated a better price:<br>
        <strong>Save $${deal.savings} (${deal.discountPercent}% off)</strong><br>
        <small>New price: ${deal.currency}${deal.finalPrice}</small>
      </div>
      <div class="notification-actions">
        <button class="btn btn-primary" data-action="accept">
          Accept Deal
        </button>
        <button class="btn btn-secondary" data-action="dismiss">
          Not Now
        </button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 100%"></div>
      </div>
    `;

    // Add event listeners
    notification.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.getAttribute('data-action');
      
      switch (action) {
        case 'accept':
          this.handleDealAcceptance(deal);
          break;
        case 'dismiss':
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 300);
          break;
      }
    });

    this.notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('visible');
    }, 100);

    // Auto expire after 30 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 30000);
  }

  private handleDealAcceptance(deal: any) {
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'accept_deal',
      dealId: deal.id,
      sessionId: deal.sessionId
    });

    // Show acceptance confirmation
    this.showNotification({
      title: 'Deal Accepted!',
      message: 'Redirecting to checkout with your negotiated price...',
      type: 'success',
      autoClose: 3000
    });
  }

  showNotification(options: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning';
    actions?: Array<{ text: string; action: string; primary?: boolean }>;
    autoClose?: number;
  }) {
    if (!this.shadowRoot) return;

    // Create notification container if it doesn't exist
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.className = 'notification-container';
      this.shadowRoot.appendChild(this.notificationContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification';

    const iconMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️'
    };

    let actionsHtml = '';
    if (options.actions && options.actions.length > 0) {
      actionsHtml = `
        <div class="notification-actions">
          ${options.actions.map(action => `
            <button class="btn ${action.primary ? 'btn-primary' : 'btn-secondary'}" 
                    data-action="${action.action}">
              ${action.text}
            </button>
          `).join('')}
        </div>
      `;
    }

    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-icon ${options.type}">${iconMap[options.type]}</div>
        <div class="notification-title">${options.title}</div>
      </div>
      <div class="notification-message">${options.message}</div>
      ${actionsHtml}
    `;

    // Add event listeners for actions
    if (options.actions) {
      notification.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const action = target.getAttribute('data-action');
        if (action) {
          chrome.runtime.sendMessage({
            type: 'notification_action',
            action
          });
          notification.remove();
        }
      });
    }

    this.notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.classList.add('visible');
    }, 100);

    // Auto close if specified
    if (options.autoClose) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 300);
        }
      }, options.autoClose);
    }
  }

  updateNegotiationStatus(status: NegotiationStatus, data?: any) {
    this.showNegotiationStatus(status, data);
  }

  private fadeOut() {
    if (this.floatingBadge) {
      this.floatingBadge.classList.add('fade-out');
      setTimeout(() => {
        this.cleanup();
      }, 300);
    }
  }

  cleanup() {
    if (this.floatingBadge) {
      this.floatingBadge.remove();
      this.floatingBadge = null;
    }

    if (this.notificationContainer) {
      this.notificationContainer.remove();
      this.notificationContainer = null;
    }

    this.currentStatus = 'idle';
  }
}