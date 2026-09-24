/**
 * @fileoverview Findly Side Panel State Machine & Controller
 */

import { analyzeImage, getProgressiveAttributes } from '../lib/analyze.js';
import { filterAndRankProducts } from '../lib/match.js';
import {
  getSettings,
  updateSettings,
  getSavedProducts,
  saveProduct,
  removeSavedProduct,
  isProductSaved,
  addRecentSearch,
  getActiveSearch,
  clearActiveSearch
} from '../lib/storage.js';
import {
  trackExtensionActivated,
  trackResultsViewed,
  trackProductViewed,
  trackProductSaved,
  trackCompareOpened,
  trackStoreClicked
} from '../lib/analytics.js';
import { getLiveStoreUrl } from '../lib/urls.js';

// --- State Variables ---
let catalog = [];
let activeState = 'idle';
let previousState = 'idle';
let activeTab = 'similar';
let currentSearch = null;
let currentAnalysis = null;
let currentProducts = [];
let currentBestMatch = null;
let activeDetailProduct = null;
let compareProducts = [];
let savedProductsList = [];
let activeSettings = {};

let activeFilters = {
  stores: ['Myntra', 'Amazon', 'Flipkart', 'Meesho'],
  minMatchScore: 0,
  sortBy: 'best-match'
};

let toastDismissTimeout = null;

/**
 * Display modern inline toast without blocking browser window.alert
 */
export function showToast(message, duration = 3000) {
  const toast = document.getElementById('sidepanel-toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.remove('hidden');

  void toast.offsetWidth; // Force reflow
  toast.classList.add('visible');

  clearTimeout(toastDismissTimeout);
  toastDismissTimeout = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 250);
  }, duration);
}

// DOM Elements
const views = {
  idle: document.getElementById('state-idle'),
  analyzing: document.getElementById('state-analyzing'),
  results: document.getElementById('state-results'),
  detail: document.getElementById('state-detail'),
  compare: document.getElementById('state-compare'),
  finds: document.getElementById('state-finds'),
  settings: document.getElementById('state-settings'),
  noMatches: document.getElementById('state-no-matches'),
  error: document.getElementById('state-error')
};

// --- Initialization ---
async function init() {
  trackExtensionActivated();

  // Load catalog
  try {
    const res = await fetch('../data/products.json');
    catalog = await res.json();
  } catch (err) {
    console.error('[Findly] Error loading products catalog:', err);
    catalog = [];
  }

  // Load settings & saved products
  activeSettings = await getSettings();
  savedProductsList = await getSavedProducts();
  updateSavedBadge();
  syncSettingsUI();

  // Attach event listeners
  setupEventListeners();

  // Check if an active search was queued in storage
  const queuedSearch = await getActiveSearch();
  if (queuedSearch && queuedSearch.src) {
    handleNewImageSearch(queuedSearch);
  } else {
    showState('idle');
  }

  // Listen for runtime messages (Direct & Relay)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if ((message.action === 'FINDLY_IMAGE_PAYLOAD_RECEIVED' || message.action === 'FINDLY_IMAGE_SELECTED') && message.data) {
        handleNewImageSearch(message.data);
      }
    });
  }

  // Also listen for storage changes (100% resilient across background / popup / content scripts)
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.findly_active_search && changes.findly_active_search.newValue) {
        const payload = changes.findly_active_search.newValue;
        if (payload && payload.src && (!currentSearch || currentSearch.src !== payload.src || (Date.now() - (payload.timestamp || 0) < 5000))) {
          handleNewImageSearch(payload);
        }
      }
    });
  }
}

// --- View State Transitions ---
function showState(stateName) {
  if (stateName !== activeState) {
    previousState = activeState;
  }
  activeState = stateName;

  Object.entries(views).forEach(([key, el]) => {
    if (el) {
      if (key === stateName) {
        el.classList.remove('hidden');
        el.classList.add('active');
      } else {
        el.classList.remove('active');
        el.classList.add('hidden');
      }
    }
  });

  // Hide or show compare dock
  updateCompareDock();
}

// --- Image Search & Analysis Flow ---
async function handleNewImageSearch(searchData) {
  currentSearch = searchData;
  showState('analyzing');

  const previewImg = document.getElementById('analyzing-img');
  if (previewImg) previewImg.src = searchData.src;

  const heading = document.getElementById('analyzing-heading');
  const subtext = document.getElementById('analyzing-subtext');
  const pillsContainer = document.getElementById('analyzing-pills');

  if (heading) heading.textContent = 'Understanding your product...';
  if (subtext) subtext.textContent = 'Extracting silhouette, color palette and textures...';
  if (pillsContainer) pillsContainer.innerHTML = '';

  try {
    // 1. Run real vision analysis abstraction (backend Vision / Google Lens pipeline)
    const analysis = await analyzeImage(searchData.src, {
      alt: searchData.alt,
      title: searchData.pageTitle,
      url: searchData.pageUrl,
      base64: searchData.base64,
      dominantColor: searchData.dominantColor
    });
    currentAnalysis = analysis;

    // Merge live Google Lens visual matches into catalog if available
    if (analysis.visualMatches && Array.isArray(analysis.visualMatches) && analysis.visualMatches.length > 0) {
      const newItems = analysis.visualMatches.filter(vm => !catalog.some(c => c.id === vm.id));
      catalog = [...newItems, ...catalog];
    }

    // 2. Progressive attribute reveals animation
    const attributePills = getProgressiveAttributes(analysis);

    for (let i = 0; i < attributePills.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 240));
      const pill = document.createElement('span');
      pill.className = `attribute-pill ${i === 0 || i === 1 ? 'highlight' : ''}`;
      pill.textContent = attributePills[i];
      pillsContainer.appendChild(pill);
    }

    if (heading) heading.textContent = 'Finding your closest matches...';
    if (subtext) subtext.textContent = 'Scanning Myntra, Amazon, Flipkart and Meesho...';

    await new Promise(resolve => setTimeout(resolve, 400));

    // 3. Process matches
    renderSearchResults();

    // 4. Save to recent searches
    await addRecentSearch({
      imageSrc: searchData.src,
      queryLabel: `${analysis.color} ${analysis.silhouette || analysis.subcategory}`,
      detectedCategory: analysis.subcategory,
      matchesCount: currentProducts.length
    });

    trackResultsViewed({
      totalMatches: currentProducts.length,
      activeTab,
      topMatchScore: currentBestMatch?.matchScore || 0
    });

  } catch (err) {
    console.error('[Findly] Analysis error:', err);
    showState('error');
    const errMsg = document.getElementById('error-message');
    if (errMsg) errMsg.textContent = err.message || 'Unable to process image.';
  }
}

// --- Render Search Results ---
function renderSearchResults() {
  if (!currentAnalysis) {
    showState('idle');
    return;
  }

  const { products, bestMatch, isExactFallback, referencePrice } = filterAndRankProducts(
    catalog,
    currentAnalysis,
    {
      ...activeFilters,
      referencePrice: currentAnalysis.estimatedPrice
    },
    activeTab
  );

  currentProducts = products;
  currentBestMatch = bestMatch;

  showState('results');

  // Update Source Bar
  const sourceThumb = document.getElementById('results-source-thumb');
  if (sourceThumb && currentSearch) sourceThumb.src = currentSearch.src;

  const countLabel = document.getElementById('results-count-label');
  if (countLabel) countLabel.textContent = `${products.length} matches found`;

  const detectedLabel = document.getElementById('results-detected-label');
  if (detectedLabel) {
    detectedLabel.textContent = `${currentAnalysis.color} ${currentAnalysis.material} ${currentAnalysis.silhouette || currentAnalysis.subcategory}`;
  }

  // Handle Tab-specific banners
  const cheaperBanner = document.getElementById('tab-banner-cheaper');
  const premiumBanner = document.getElementById('tab-banner-premium');
  const exactFallbackBanner = document.getElementById('tab-banner-exact-fallback');
  const closestMatchSection = document.getElementById('closest-match-section');

  cheaperBanner?.classList.add('hidden');
  premiumBanner?.classList.add('hidden');
  exactFallbackBanner?.classList.add('hidden');

  if (activeTab === 'cheaper') {
    cheaperBanner?.classList.remove('hidden');
    const cheaperSub = document.getElementById('cheaper-banner-sub');
    if (cheaperSub) {
      const budgetCap = Math.max(999, Math.round(referencePrice * 0.75));
      cheaperSub.textContent = `Original reference price: ₹${referencePrice.toLocaleString('en-IN')} • ${products.length} similar products under ₹${budgetCap.toLocaleString('en-IN')}`;
    }
    closestMatchSection?.classList.add('hidden');
  } else if (activeTab === 'premium') {
    premiumBanner?.classList.remove('hidden');
    closestMatchSection?.classList.add('hidden');
  } else if (activeTab === 'exact') {
    if (products.length === 0) {
      closestMatchSection?.classList.add('hidden');
      exactFallbackBanner?.classList.add('hidden');
    } else {
      closestMatchSection?.classList.remove('hidden');
    }
  } else {
    // Similar tab: default
    closestMatchSection?.classList.remove('hidden');
  }

  // Render Closest Match Card
  if (activeTab === 'exact' && products.length === 0) {
    renderClosestMatchCard(null);
  } else {
    renderClosestMatchCard(bestMatch);
  }

  // Render Product Grid
  renderProductGrid(products, bestMatch);
}

// --- Closest Match Card Render ---
function renderClosestMatchCard(product) {
  const container = document.getElementById('closest-match-card');
  if (!container) return;

  if (!product) {
    container.innerHTML = '';
    return;
  }

  const isSaved = savedProductsList.some(p => p.id === product.id);
  const isCompared = compareProducts.some(p => p.id === product.id);
  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : null;

  container.innerHTML = `
    <div class="shadcn-card closest-match-card-inner">
      <div class="closest-match-header">
        <div class="badge-best-match">
          <span class="badge-pulse-dot"></span>
          <span>Best Match • ${product.matchScore}%</span>
        </div>
        <span class="store-badge-pill ${product.store.toLowerCase()}">
          <span class="store-dot ${product.store.toLowerCase()}"></span>
          ${product.store}
        </span>
      </div>

      <div class="closest-match-body">
        <div class="closest-match-img-wrap" data-id="${product.id}" title="Click to view details">
          <img src="${product.image}" alt="${product.name}" class="closest-match-img" loading="lazy">
        </div>
        <div class="closest-match-details">
          <h4 class="closest-product-name" data-id="${product.id}" title="${product.name}">${product.name}</h4>
          <div class="closest-price-row">
            <span class="price-current">₹${product.price.toLocaleString('en-IN')}</span>
            ${product.originalPrice && product.originalPrice > product.price ? `
              <span class="price-original">₹${product.originalPrice.toLocaleString('en-IN')}</span>
              <span class="badge-discount">${discountPercent}% off</span>
            ` : ''}
          </div>
          <p class="closest-reason-text">
            ${product.matchReason || 'Matches silhouette, color, and textile.'}
          </p>
        </div>
      </div>

      <div class="closest-match-footer">
        <button class="btn-shadcn-primary flex-1 btn-view-store" data-url="${getLiveStoreUrl(product)}" data-id="${product.id}">
          <span>Visit ${product.store}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
        <button class="btn-shadcn-secondary btn-toggle-compare ${isCompared ? 'active' : ''}" data-id="${product.id}" title="Compare specifications">
          ${isCompared ? '✓ Added' : '+ Compare'}
        </button>
        <button class="btn-shadcn-ghost btn-save-card ${isSaved ? 'saved' : ''}" data-id="${product.id}" title="${isSaved ? 'Remove from saved' : 'Save find'}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// --- Product Grid Render ---
function renderProductGrid(products, bestMatch) {
  const gridContainer = document.getElementById('products-grid');
  const heading = document.getElementById('grid-section-heading');
  const countBadge = document.getElementById('grid-count-badge');
  if (!gridContainer) return;

  // On similar tab with best match, grid displays the rest
  let gridItems = products;
  if (activeTab === 'similar' && bestMatch) {
    gridItems = products.filter(p => p.id !== bestMatch.id);
  }

  if (heading) {
    heading.textContent = activeTab === 'cheaper' ? 'VALUE ALTERNATIVES' :
                          activeTab === 'premium' ? 'PREMIUM TIERS' :
                          activeTab === 'exact' ? 'EXACT MATCHES' :
                          'FEATURED MATCHES';
  }

  if (countBadge) {
    countBadge.textContent = `${gridItems.length} items`;
  }

  if (gridItems.length === 0) {
    if (activeTab === 'exact') {
      gridContainer.innerHTML = `
        <div class="exact-empty-state">
          <div class="exact-empty-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <div class="exact-empty-title">No exact match found</div>
            <p class="exact-empty-desc">No item met the 92%+ visual threshold. Check the "Similar" tab for related styles.</p>
          </div>
          <button class="btn-switch-similar btn-switch-similar-tab">
            <span>Explore Similar Styles</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      `;
      gridContainer.querySelector('.btn-switch-similar-tab')?.addEventListener('click', () => {
        if (typeof window.switchTab === 'function') {
          window.switchTab('similar');
        }
      });
      return;
    }

    gridContainer.innerHTML = `
      <div class="empty-grid-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>No products found under this filter.</p>
        <button class="btn-shadcn-ghost btn-sm" id="btn-grid-reset-filters">Reset filters</button>
      </div>
    `;
    document.getElementById('btn-grid-reset-filters')?.addEventListener('click', () => {
      document.getElementById('btn-reset-filters')?.click();
    });
    return;
  }

  gridContainer.innerHTML = gridItems.map(p => {
    const isSaved = savedProductsList.some(s => s.id === p.id);
    const isCompared = compareProducts.some(c => c.id === p.id);
    const discountPercent = p.originalPrice && p.originalPrice > p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : null;

    return `
      <div class="shadcn-product-card" data-id="${p.id}">
        <div class="card-img-container" data-id="${p.id}">
          <img src="${p.image}" alt="${p.name}" class="card-img" loading="lazy">
          
          <div class="card-floating-top">
            <span class="badge-match-pill">${p.matchScore}%</span>
            <button class="card-save-btn ${isSaved ? 'saved' : ''}" data-id="${p.id}" title="${isSaved ? 'Remove from saved' : 'Save'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
          </div>

          <div class="card-floating-bottom">
            <button class="card-compare-badge ${isCompared ? 'active' : ''}" data-id="${p.id}" title="Toggle compare">
              ${isCompared ? '✓ In Compare' : '+ Compare'}
            </button>
          </div>
        </div>

        <div class="card-content">
          <div class="card-store-row">
            <span class="store-badge-pill ${p.store.toLowerCase()}">
              <span class="store-dot ${p.store.toLowerCase()}"></span>
              ${p.store}
            </span>
          </div>
          
          <h4 class="card-title" data-id="${p.id}" title="${p.name}">${p.name}</h4>
          
          <div class="card-price-row">
            <span class="price-current">₹${p.price.toLocaleString('en-IN')}</span>
            ${p.originalPrice && p.originalPrice > p.price ? `
              <span class="price-original">₹${p.originalPrice.toLocaleString('en-IN')}</span>
              <span class="badge-discount">${discountPercent}%</span>
            ` : ''}
          </div>

          <button class="btn-shadcn-outline btn-card-store btn-view-store" data-url="${getLiveStoreUrl(p)}" data-id="${p.id}">
            <span>Visit store</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Product Detail View ---
function openProductDetail(productId) {
  const product = currentProducts.find(p => p.id === productId) || catalog.find(p => p.id === productId) || (currentBestMatch?.id === productId ? currentBestMatch : null);
  if (!product) return;

  activeDetailProduct = product;
  trackProductViewed(product);

  const container = document.getElementById('detail-content');
  const isSaved = savedProductsList.some(p => p.id === product.id);
  const isCompared = compareProducts.some(p => p.id === product.id);

  // Sync header save button
  const saveBtn = document.getElementById('btn-detail-save');
  if (saveBtn) {
    saveBtn.className = `btn-icon ${isSaved ? 'saved' : ''}`;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    `;
  }

  // Why this matches attributes
  const reasons = product.matchReasons || [
    '✓ Similar colour',
    '✓ Similar silhouette',
    '✓ Similar material'
  ];

  container.innerHTML = `
    <div class="detail-image-wrap">
      <img src="${product.image}" alt="${product.name}" class="detail-image">
    </div>

    <div class="detail-headline">
      <div class="detail-meta-row">
        <span class="match-badge">${product.matchScore || 95}% Match</span>
        <span class="store-pill ${product.store.toLowerCase()}">${product.store}</span>
      </div>
      <h2 class="detail-product-name">${product.name}</h2>
      <div class="detail-price-box">
        <span class="detail-price">₹${product.price.toLocaleString('en-IN')}</span>
        <span class="price-original">₹${product.originalPrice.toLocaleString('en-IN')}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">WHY IT MATCHES</div>
      <div class="detail-attributes-list">
        ${reasons.map(r => `
          <div class="detail-attribute-item">
            <span class="check-icon">✓</span>
            <span>${r.replace(/^[✓\s]+/, '')}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">AVAILABLE ON</div>
      <div class="available-store-card">
        <div class="available-store-info">
          <span class="available-store-name">${product.store}</span>
          <span class="available-store-delivery">Standard delivery: ${product.delivery || '2-3 business days'}</span>
        </div>
        <span class="price-current">₹${product.price.toLocaleString('en-IN')}</span>
      </div>
    </div>

    <div class="detail-ctas">
      <button class="btn-primary flex-1 btn-view-store" data-url="${getLiveStoreUrl(product)}" data-id="${product.id}">
        View product
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </button>
      <button class="btn-secondary btn-toggle-compare ${isCompared ? 'active' : ''}" data-id="${product.id}">
        ${isCompared ? '✓ In Compare' : 'Compare'}
      </button>
    </div>
  `;

  showState('detail');
}

// --- Compare Mode & Table Render ---
function toggleCompareProduct(productId) {
  const idx = compareProducts.findIndex(p => p.id === productId);
  if (idx >= 0) {
    compareProducts.splice(idx, 1);
  } else {
    if (compareProducts.length >= 3) {
      showToast('Maximum 3 products can be compared. Deselect one to add another.', 3000);
      return;
    }
    const product = currentProducts.find(p => p.id === productId) || catalog.find(p => p.id === productId) || (currentBestMatch?.id === productId ? currentBestMatch : null);
    if (product) compareProducts.push(product);
  }

  updateCompareDock();
  // Re-render active views so compare button toggles match
  if (activeState === 'results') {
    renderClosestMatchCard(currentBestMatch);
    renderProductGrid(currentProducts, currentBestMatch);
  } else if (activeState === 'detail' && activeDetailProduct) {
    openProductDetail(activeDetailProduct.id);
  } else if (activeState === 'compare') {
    renderCompareTable();
  }
}

function updateCompareDock() {
  const dock = document.getElementById('compare-dock');
  if (!dock) return;

  if (compareProducts.length > 0 && activeState !== 'compare') {
    dock.classList.remove('hidden');
    const thumbContainer = document.getElementById('dock-thumbnails');
    const countLabel = document.getElementById('dock-count-label');

    if (thumbContainer) {
      thumbContainer.innerHTML = compareProducts.map(p => `
        <img src="${p.image}" class="dock-thumb" alt="${p.name}">
      `).join('');
    }
    if (countLabel) {
      countLabel.textContent = `${compareProducts.length} ${compareProducts.length === 1 ? 'product' : 'products'} to compare`;
    }
  } else {
    dock.classList.add('hidden');
  }
}

function openCompareView() {
  if (compareProducts.length === 0) return;
  trackCompareOpened(compareProducts);
  renderCompareTable();
  showState('compare');
}

function renderCompareTable() {
  const container = document.getElementById('compare-table-wrapper');
  if (!container) return;

  if (compareProducts.length === 0) {
    container.innerHTML = `
      <div style="padding: 32px; text-align: center; color: var(--text-secondary);">
        No products selected to compare.
      </div>
    `;
    return;
  }

  const queryImage = currentSearch?.src || '';
  const queryAttrs = currentAnalysis || {};

  const attributes = [
    {
      label: 'Store',
      queryVal: '<span class="store-badge-pill" style="background: var(--accent-lime); color: #000000; font-weight: 700;">Target Style</span>',
      render: p => `<span class="store-badge-pill ${p.store.toLowerCase()}">${p.store}</span>`
    },
    {
      label: 'Price',
      queryVal: queryAttrs.estimatedPrice ? `<strong>~₹${queryAttrs.estimatedPrice.toLocaleString('en-IN')}</strong>` : '—',
      render: p => `<strong>₹${p.price.toLocaleString('en-IN')}</strong>`
    },
    {
      label: 'Match Score',
      queryVal: '<span class="badge-best-match">Reference 100%</span>',
      render: p => `<span class="badge-match-pill">${p.matchScore || 90}%</span>`
    },
    {
      label: 'Category',
      queryVal: queryAttrs.subcategory || queryAttrs.category || 'Fashion',
      render: p => `${p.subcategory || p.category}`
    },
    {
      label: 'Colour',
      queryVal: queryAttrs.color || '—',
      render: p => `${p.color || '—'}`
    },
    {
      label: 'Material',
      queryVal: queryAttrs.material || '—',
      render: p => `${p.material || '—'}`
    },
    {
      label: 'Silhouette',
      queryVal: queryAttrs.silhouette || queryAttrs.fit || '—',
      render: p => `${p.silhouette || p.fit || '—'}`
    },
    {
      label: 'Occasion',
      queryVal: queryAttrs.occasion || '—',
      render: p => `${p.occasion || p.style || '—'}`
    },
    {
      label: 'Rating',
      queryVal: '—',
      render: p => `★ ${p.rating} / 5.0`
    },
    {
      label: 'Action',
      queryVal: '<span style="font-size: 11px; color: var(--text-muted);">Query Item</span>',
      render: p => `
        <button class="btn-shadcn-primary w-full btn-view-store" data-url="${getLiveStoreUrl(p)}" data-id="${p.id}" style="padding: 6px 8px; font-size: 11px;">
          View product
        </button>
      `
    }
  ];

  container.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Attribute</th>
          ${queryImage ? `
            <th class="compare-product-col" style="background: rgba(210, 245, 53, 0.08); border-right: 2px solid var(--border-subtle);">
              <div class="compare-thumb-wrap">
                <img src="${queryImage}" alt="Selected Image" class="compare-thumb" style="border: 2px solid var(--accent-lime);">
              </div>
              <div class="compare-product-name" style="color: var(--text-primary); font-weight: 700;">Selected Pin</div>
              <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em;">Target Image</span>
            </th>
          ` : ''}
          ${compareProducts.map(p => `
            <th class="compare-product-col">
              <div class="compare-thumb-wrap">
                <img src="${p.image}" alt="${p.name}" class="compare-thumb">
              </div>
              <div class="compare-product-name">${p.name}</div>
              <button class="btn-text btn-remove-compare" data-id="${p.id}" style="font-size: 10px; color: var(--text-muted); cursor: pointer;">Remove</button>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${attributes.map(attr => `
          <tr>
            <th>${attr.label}</th>
            ${queryImage ? `
              <td class="compare-product-col" style="background: rgba(168, 85, 247, 0.03); border-right: 2px solid var(--border-subtle); font-weight: 500;">
                ${attr.queryVal}
              </td>
            ` : ''}
            ${compareProducts.map(p => `
              <td class="compare-product-col">
                ${attr.render ? attr.render(p) : (p[attr.key] || '—')}
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// --- My Finds (Saved Products) ---
async function toggleSaveProduct(productId) {
  const isSaved = savedProductsList.some(p => p.id === productId);
  const product = currentProducts.find(p => p.id === productId) || catalog.find(p => p.id === productId) || (currentBestMatch?.id === productId ? currentBestMatch : null);

  if (isSaved) {
    savedProductsList = await removeSavedProduct(productId);
  } else if (product) {
    savedProductsList = await saveProduct(product);
    trackProductSaved(product);
  }

  updateSavedBadge();

  if (activeState === 'finds') {
    renderFindsList();
  } else if (activeState === 'results') {
    renderClosestMatchCard(currentBestMatch);
    renderProductGrid(currentProducts, currentBestMatch);
  } else if (activeState === 'detail' && activeDetailProduct) {
    openProductDetail(activeDetailProduct.id);
  }
}

function updateSavedBadge() {
  const badge = document.getElementById('saved-badge');
  const countBadge = document.getElementById('finds-count-badge');
  if (badge) {
    if (savedProductsList.length > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
  if (countBadge) {
    countBadge.textContent = `${savedProductsList.length} saved`;
  }
}

function openFindsView() {
  renderFindsList();
  showState('finds');
}

function renderFindsList() {
  const container = document.getElementById('finds-list');
  if (!container) return;

  if (savedProductsList.length === 0) {
    container.innerHTML = `
      <div style="padding: 48px 16px; text-align: center; color: var(--text-secondary);">
        <p style="font-size: 14px; margin-bottom: 6px; font-weight: 500;">No saved products yet</p>
        <p style="font-size: 12px; color: var(--text-muted);">Save items you like to compare or purchase later.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = savedProductsList.map(p => `
    <div class="saved-item-card">
      <img src="${p.image}" alt="${p.name}" class="saved-item-thumb" data-id="${p.id}">
      <div class="saved-item-details">
        <div class="saved-item-name" data-id="${p.id}">${p.name}</div>
        <div class="saved-item-meta"><span class="store-pill ${p.store.toLowerCase()}">${p.store}</span> • ${p.matchScore || 95}% Match</div>
        <div class="saved-item-price">₹${p.price.toLocaleString('en-IN')}</div>
      </div>
      <div class="saved-item-actions">
        <button class="btn-secondary btn-view-store" data-url="${getLiveStoreUrl(p)}" data-id="${p.id}" style="padding: 5px 10px; font-size: 11px;">
          View
        </button>
        <button class="btn-text btn-remove-saved" data-id="${p.id}" style="color: var(--text-muted);">
          Remove
        </button>
      </div>
    </div>
  `).join('');
}

// --- Settings Management ---
function syncSettingsUI() {
  const hoverBtn = document.getElementById('setting-hover-btn');
  const autoOpen = document.getElementById('setting-auto-open');
  const enableShopping = document.getElementById('setting-enable-shopping');
  const defaultSort = document.getElementById('setting-default-sort');
  const dataSource = document.getElementById('setting-data-source');

  if (hoverBtn) hoverBtn.checked = activeSettings.showFindlyButtonOnImages !== false;
  if (autoOpen) autoOpen.checked = activeSettings.autoOpenSidePanel !== false;
  if (enableShopping) enableShopping.checked = activeSettings.enableOnShoppingWebsites !== false;
  if (defaultSort) defaultSort.value = activeSettings.defaultSort || 'best-match';
  if (dataSource) dataSource.value = activeSettings.dataSource || 'local';
}

async function handleSettingChange(key, value) {
  activeSettings = await updateSettings({ [key]: value });
  if (key === 'defaultSort') {
    activeFilters.sortBy = value;
    if (activeState === 'results') renderSearchResults();
  }
}

// --- Trigger Selection Mode In Host Webpage ---
function triggerSelectionMode() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'FINDLY_TRIGGER_SELECTION_MODE' }, (res) => {
      if (chrome.runtime.lastError) {
        console.warn('[Findly] Error triggering selection mode:', chrome.runtime.lastError.message);
      }
    });
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Brand Header
  document.getElementById('btn-brand')?.addEventListener('click', () => {
    if (currentProducts.length > 0) {
      showState('results');
    } else {
      showState('idle');
    }
  });

  // Top Nav Buttons
  document.getElementById('btn-open-select')?.addEventListener('click', triggerSelectionMode);
  document.getElementById('btn-idle-select')?.addEventListener('click', triggerSelectionMode);
  document.getElementById('btn-nav-finds')?.addEventListener('click', openFindsView);
  document.getElementById('btn-nav-settings')?.addEventListener('click', () => showState('settings'));

  // Back Buttons
  document.getElementById('btn-detail-back')?.addEventListener('click', () => showState('results'));
  document.getElementById('btn-compare-back')?.addEventListener('click', () => showState('results'));
  document.getElementById('btn-finds-back')?.addEventListener('click', () => showState(previousState || 'results'));
  document.getElementById('btn-settings-back')?.addEventListener('click', () => showState(previousState || 'results'));

  // Cancel & Retry Buttons
  document.getElementById('btn-cancel-analysis')?.addEventListener('click', () => showState('idle'));
  document.getElementById('btn-change-selection')?.addEventListener('click', triggerSelectionMode);
  document.getElementById('btn-change-img')?.addEventListener('click', triggerSelectionMode);
  document.getElementById('btn-no-matches-retry')?.addEventListener('click', triggerSelectionMode);
  document.getElementById('btn-error-retry')?.addEventListener('click', triggerSelectionMode);

  // Helper to switch tab and re-render
  window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
    activeTab = tabName;
    renderSearchResults();
  };

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      if (tabName) window.switchTab(tabName);
    });
  });

  // Filter Drawer Toggle
  const filterDrawer = document.getElementById('filter-drawer');
  document.getElementById('btn-filter-toggle')?.addEventListener('click', () => {
    filterDrawer?.classList.toggle('hidden');
  });

  // Filter Chips (Stores)
  document.querySelectorAll('.chip-store').forEach(chip => {
    chip.addEventListener('click', () => {
      const store = chip.getAttribute('data-store');
      chip.classList.toggle('active');

      const activeStores = Array.from(document.querySelectorAll('.chip-store.active'))
        .map(c => c.getAttribute('data-store'));
      activeFilters.stores = activeStores;
      updateFilterIndicator();
      renderSearchResults();
    });
  });

  // Filter Chips (Min Score)
  document.querySelectorAll('.chip-score').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip-score').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters.minMatchScore = parseInt(chip.getAttribute('data-min'), 10) || 0;
      updateFilterIndicator();
      renderSearchResults();
    });
  });

  // Filter Chips (Sort)
  document.querySelectorAll('.chip-sort').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip-sort').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters.sortBy = chip.getAttribute('data-sort');
      updateFilterIndicator();
      renderSearchResults();
    });
  });

  // Reset Filters
  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    activeFilters = {
      stores: ['Myntra', 'Amazon', 'Flipkart', 'Meesho'],
      minMatchScore: 0,
      sortBy: 'best-match'
    };
    document.querySelectorAll('.chip-store').forEach(c => c.classList.add('active'));
    document.querySelectorAll('.chip-score').forEach(c => c.classList.toggle('active', c.getAttribute('data-min') === '0'));
    document.querySelectorAll('.chip-sort').forEach(c => c.classList.toggle('active', c.getAttribute('data-sort') === 'best-match'));
    updateFilterIndicator();
    renderSearchResults();
  });

  // Settings Toggles
  document.getElementById('setting-hover-btn')?.addEventListener('change', (e) => {
    handleSettingChange('showFindlyButtonOnImages', e.target.checked);
  });
  document.getElementById('setting-auto-open')?.addEventListener('change', (e) => {
    handleSettingChange('autoOpenSidePanel', e.target.checked);
  });
  document.getElementById('setting-enable-shopping')?.addEventListener('change', (e) => {
    handleSettingChange('enableOnShoppingWebsites', e.target.checked);
  });
  document.getElementById('setting-default-sort')?.addEventListener('change', (e) => {
    handleSettingChange('defaultSort', e.target.value);
  });
  document.getElementById('setting-data-source')?.addEventListener('change', (e) => {
    handleSettingChange('dataSource', e.target.value);
  });

  // Compare Dock
  document.getElementById('btn-dock-view')?.addEventListener('click', openCompareView);
  document.getElementById('btn-dock-dismiss')?.addEventListener('click', () => {
    compareProducts = [];
    updateCompareDock();
    if (activeState === 'results') {
      renderClosestMatchCard(currentBestMatch);
      renderProductGrid(currentProducts, currentBestMatch);
    }
  });

  document.getElementById('btn-compare-clear')?.addEventListener('click', () => {
    compareProducts = [];
    renderCompareTable();
    updateCompareDock();
  });

  // Idle Sample Inspiration Click
  document.querySelectorAll('.sample-card').forEach(card => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img');
      const title = card.querySelector('.sample-title')?.textContent || '';
      handleNewImageSearch({
        src: img.src,
        alt: title,
        pageTitle: title,
        pageUrl: 'https://pinterest.com/sample',
        mode: 'sample'
      });
    });
  });

  // Global Delegated Clicks for Dynamic Product Cards & Buttons
  document.addEventListener('click', (e) => {
    // 1. View store CTA (Opens in new tab)
    const storeBtn = e.target.closest('.btn-view-store');
    if (storeBtn) {
      e.stopPropagation();
      let url = storeBtn.getAttribute('data-url');
      const id = storeBtn.getAttribute('data-id');
      const product = currentProducts.find(p => p.id === id) || catalog.find(p => p.id === id) || (currentBestMatch?.id === id ? currentBestMatch : null);
      trackStoreClicked(product);
      if (!url || url.includes('example.com')) {
        url = getLiveStoreUrl(product);
      }
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // 2. Toggle Compare
    const compareBtn = e.target.closest('.btn-toggle-compare, .card-quick-compare, .card-compare-badge');
    if (compareBtn) {
      e.stopPropagation();
      const id = compareBtn.getAttribute('data-id');
      if (id) toggleCompareProduct(id);
      return;
    }

    // 3. Remove from compare
    const removeCompareBtn = e.target.closest('.btn-remove-compare');
    if (removeCompareBtn) {
      e.stopPropagation();
      const id = removeCompareBtn.getAttribute('data-id');
      if (id) toggleCompareProduct(id);
      return;
    }

    // 4. Save Product
    const saveBtn = e.target.closest('.card-save-btn, .btn-save-card, #btn-detail-save');
    if (saveBtn) {
      e.stopPropagation();
      const id = saveBtn.getAttribute('data-id') || activeDetailProduct?.id;
      if (id) toggleSaveProduct(id);
      return;
    }

    // 5. Remove from saved list
    const removeSavedBtn = e.target.closest('.btn-remove-saved');
    if (removeSavedBtn) {
      e.stopPropagation();
      const id = removeSavedBtn.getAttribute('data-id');
      if (id) toggleSaveProduct(id);
      return;
    }

    // 6. Open Product Detail
    const detailTarget = e.target.closest('.closest-match-img-wrap, .closest-product-name, .card-img-wrap, .card-img-container, .card-name, .card-title, .saved-item-thumb, .saved-item-name');
    if (detailTarget && !e.target.closest('.card-save-btn, .card-quick-compare, .card-compare-badge, .btn-view-store')) {
      const id = detailTarget.getAttribute('data-id');
      if (id) openProductDetail(id);
      return;
    }
  });
}

function updateFilterIndicator() {
  const indicator = document.getElementById('filter-active-indicator');
  const isDefault = activeFilters.stores.length === 4 &&
                    activeFilters.minMatchScore === 0 &&
                    activeFilters.sortBy === 'best-match';
  if (indicator) {
    if (!isDefault) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
    }
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
