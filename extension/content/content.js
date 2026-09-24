/**
 * @fileoverview Findly In-Page Content Script
 * Implements Mode 1 (Hover Action) and Mode 2 (Interactive Selection Mode)
 */

(function () {
  // Prevent duplicate injection
  if (window.__FINDLY_INITIALIZED__) return;
  window.__FINDLY_INITIALIZED__ = true;

  const MIN_IMAGE_SIZE = 120; // Ignore tiny icons, logos, tracking pixels

  let settings = {
    showFindlyButtonOnImages: true,
    enableOnShoppingWebsites: true
  };

  let hoverPillEl = null;
  let activeImageEl = null;
  let pillHideTimeout = null;
  let isSelectionModeActive = false;
  let currentHighlightedEl = null;
  let selectionBannerEl = null;

  // Initialize settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['findly_settings'], result => {
      if (result.findly_settings) {
        settings = { ...settings, ...result.findly_settings };
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.findly_settings) {
        settings = { ...settings, ...changes.findly_settings.newValue };
      }
    });
  }

  /**
   * Create or get hover pill DOM element
   */
  function getOrCreateHoverPill() {
    if (hoverPillEl) return hoverPillEl;

    hoverPillEl = document.createElement('div');
    hoverPillEl.id = 'findly-hover-pill';
    hoverPillEl.innerHTML = `
      <span class="findly-pill-icon">🔍</span>
      <span class="findly-pill-text">Find similar</span>
    `;

    document.documentElement.appendChild(hoverPillEl);

    // Keep pill visible when hovering over the pill itself
    hoverPillEl.addEventListener('mouseenter', () => {
      clearTimeout(pillHideTimeout);
    });

    hoverPillEl.addEventListener('mouseleave', () => {
      hidePill();
    });

    hoverPillEl.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (activeImageEl) {
        selectImage(activeImageEl, 'hover');
      }
      hidePill(0);
    });

    return hoverPillEl;
  }

  /**
   * Determine if an element is an eligible product image
   */
  function isEligibleImage(el) {
    if (!el || el === hoverPillEl || hoverPillEl?.contains(el)) return false;
    if (selectionBannerEl?.contains(el)) return false;

    // Check <img> elements
    if (el.tagName === 'IMG') {
      const rect = el.getBoundingClientRect();
      const naturalW = el.naturalWidth || rect.width;
      const naturalH = el.naturalHeight || rect.height;
      return (rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE) ||
             (naturalW >= MIN_IMAGE_SIZE && naturalH >= MIN_IMAGE_SIZE);
    }

    // Check background-image elements or picture sources
    if (el.getAttribute('role') === 'img') {
      const rect = el.getBoundingClientRect();
      return rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE;
    }

    // Check computed background-image
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && bg.startsWith('url(')) {
      const rect = el.getBoundingClientRect();
      return rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE;
    }

    return false;
  }

  /**
   * Extract image source URL
   */
  function extractImageSrc(el) {
    if (el.tagName === 'IMG') {
      return el.currentSrc || el.src || el.getAttribute('data-src') || el.getAttribute('srcset');
    }

    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg.startsWith('url(')) {
      const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) return match[1];
    }

    // Check child img
    const childImg = el.querySelector('img');
    if (childImg) return childImg.currentSrc || childImg.src;

    return null;
  }

  /**
   * Position the hover pill over the active image
   */
  function showPillOver(imgEl) {
    if (!settings.showFindlyButtonOnImages || isSelectionModeActive) return;

    activeImageEl = imgEl;
    const pill = getOrCreateHoverPill();
    clearTimeout(pillHideTimeout);

    const rect = imgEl.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Position 10px inside top-right corner
    let top = rect.top + scrollY + 10;
    let left = rect.right + scrollX - 110;

    // Bounds safety
    if (left < scrollX + 10) left = scrollX + 10;
    if (top < scrollY + 10) top = scrollY + 10;

    pill.style.top = `${top}px`;
    pill.style.left = `${left}px`;
    pill.classList.add('findly-visible');
  }

  /**
   * Hide the hover pill with debounce
   */
  function hidePill(delay = 200) {
    clearTimeout(pillHideTimeout);
    pillHideTimeout = setTimeout(() => {
      if (hoverPillEl) {
        hoverPillEl.classList.remove('findly-visible');
      }
      activeImageEl = null;
    }, delay);
  }

  /**
  let toastEl = null;
  let toastTimeout = null;

  function showFeedbackToast(src, alt) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'findly-toast';
      document.documentElement.appendChild(toastEl);
    }

    toastEl.innerHTML = `
      <img src="${src}" class="findly-toast-thumb" alt="Product preview">
      <div class="findly-toast-text">
        <span class="findly-toast-title">Finding similar with Findly...</span>
        <span class="findly-toast-desc">${alt ? (alt.slice(0, 30) + '...') : 'Analyzing silhouette & style'}</span>
      </div>
      <button class="findly-toast-btn" id="findly-toast-open-btn">Open Panel</button>
    `;

    clearTimeout(toastTimeout);
    requestAnimationFrame(() => {
      toastEl.classList.add('findly-toast-visible');
    });

    const openBtn = toastEl.querySelector('#findly-toast-open-btn');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'FINDLY_OPEN_SIDE_PANEL' });
        }
      });
    }

    toastTimeout = setTimeout(() => {
      if (toastEl) toastEl.classList.remove('findly-toast-visible');
    }, 4500);
  }

  /**
   * Send selected image message to background / sidepanel
   */
  function selectImage(el, mode = 'hover') {
    const src = extractImageSrc(el);
    if (!src) return;

    const rect = el.getBoundingClientRect();
    const altText = el.getAttribute('alt') || el.getAttribute('title') || '';
    const payload = {
      action: 'FINDLY_IMAGE_SELECTED',
      data: {
        src,
        alt: altText,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        pageTitle: document.title,
        pageUrl: window.location.href,
        mode,
        timestamp: Date.now()
      }
    };

    // Show instant visual toast feedback right on the page
    showFeedbackToast(src, altText);

    // Relay through chrome runtime
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          console.debug('[Findly] Runtime message relay note:', chrome.runtime.lastError.message);
        }
      });
    }

    // Flash subtle feedback outline on the selected image
    el.classList.add('findly-image-highlight');
    setTimeout(() => {
      el.classList.remove('findly-image-highlight');
    }, 1000);
  }

  // --- Mode 1 Hover Listeners ---
  document.addEventListener('mouseover', (e) => {
    if (isSelectionModeActive) return;

    let target = e.target;
    // Walk up up to 2 levels to check for eligible container
    for (let i = 0; i < 2 && target && target !== document.body; i++) {
      if (isEligibleImage(target)) {
        showPillOver(target);
        return;
      }
      target = target.parentElement;
    }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (isSelectionModeActive) return;
    const related = e.relatedTarget;
    if (!related || (hoverPillEl && (related === hoverPillEl || hoverPillEl.contains(related)))) {
      return;
    }
    hidePill();
  }, { passive: true });

  // --- Mode 2 Selection Mode Implementation ---

  function startSelectionMode() {
    if (isSelectionModeActive) return;
    isSelectionModeActive = true;
    hidePill(0);

    document.documentElement.classList.add('findly-selection-active');

    // Create top status banner
    if (!selectionBannerEl) {
      selectionBannerEl = document.createElement('div');
      selectionBannerEl.id = 'findly-selection-banner';
      selectionBannerEl.innerHTML = `
        <span class="findly-banner-dot"></span>
        <span>Select any product image on this page</span>
        <button class="findly-banner-close" title="Cancel (Esc)">✕</button>
      `;
      document.documentElement.appendChild(selectionBannerEl);

      const closeBtn = selectionBannerEl.querySelector('.findly-banner-close');
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exitSelectionMode();
      });
    }

    requestAnimationFrame(() => {
      selectionBannerEl.classList.add('findly-banner-visible');
    });

    document.addEventListener('mouseover', onSelectionHover, true);
    document.addEventListener('mouseout', onSelectionUnhover, true);
    document.addEventListener('click', onSelectionClick, true);
    document.addEventListener('keydown', onSelectionKeyDown, true);
  }

  function exitSelectionMode() {
    if (!isSelectionModeActive) return;
    isSelectionModeActive = false;

    document.documentElement.classList.remove('findly-selection-active');

    if (currentHighlightedEl) {
      currentHighlightedEl.classList.remove('findly-image-highlight');
      currentHighlightedEl = null;
    }

    if (selectionBannerEl) {
      selectionBannerEl.classList.remove('findly-banner-visible');
    }

    document.removeEventListener('mouseover', onSelectionHover, true);
    document.removeEventListener('mouseout', onSelectionUnhover, true);
    document.removeEventListener('click', onSelectionClick, true);
    document.removeEventListener('keydown', onSelectionKeyDown, true);
  }

  function onSelectionHover(e) {
    if (!isSelectionModeActive) return;
    let target = e.target;
    for (let i = 0; i < 2 && target && target !== document.body; i++) {
      if (isEligibleImage(target)) {
        if (currentHighlightedEl && currentHighlightedEl !== target) {
          currentHighlightedEl.classList.remove('findly-image-highlight');
        }
        currentHighlightedEl = target;
        currentHighlightedEl.classList.add('findly-image-highlight');
        return;
      }
      target = target.parentElement;
    }
  }

  function onSelectionUnhover(e) {
    if (!isSelectionModeActive) return;
    if (currentHighlightedEl && e.target === currentHighlightedEl) {
      currentHighlightedEl.classList.remove('findly-image-highlight');
      currentHighlightedEl = null;
    }
  }

  function onSelectionClick(e) {
    if (!isSelectionModeActive) return;
    if (selectionBannerEl?.contains(e.target)) return;

    let target = e.target;
    for (let i = 0; i < 3 && target && target !== document.body; i++) {
      if (isEligibleImage(target)) {
        e.preventDefault();
        e.stopPropagation();
        selectImage(target, 'selection');
        exitSelectionMode();
        return;
      }
      target = target.parentElement;
    }
  }

  function onSelectionKeyDown(e) {
    if (e.key === 'Escape') {
      exitSelectionMode();
    }
  }

  // --- Runtime Message Listener (Popup & Side Panel) ---
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'FINDLY_START_SELECTION_MODE') {
        startSelectionMode();
        sendResponse({ success: true });
        return true;
      }
      if (message.action === 'FINDLY_CANCEL_SELECTION_MODE') {
        exitSelectionMode();
        sendResponse({ success: true });
        return true;
      }
    });
  }

  console.log('[Findly] Content script active with Hover and Selection modes.');
})();
