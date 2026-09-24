/**
 * @fileoverview Findly In-Page Content Script
 * Implements Mode 1 (Hover Action with Shadow DOM) and Mode 2 (Interactive Selection Mode)
 * Deeply integrates with Pinterest pin structures, overlay buttons, and dynamic image containers.
 */

(function () {
  // Prevent duplicate injection
  if (window.__FINDLY_INITIALIZED__) return;
  window.__FINDLY_INITIALIZED__ = true;

  const MIN_IMAGE_SIZE = 110; // Ignore tiny icons, badges, tracking pixels

  let settings = {
    showFindlyButtonOnImages: true,
    enableOnShoppingWebsites: true
  };

  let shadowHost = null;
  let shadowRoot = null;
  let hoverPillEl = null;
  let activeImageEl = null;
  let pillHideTimeout = null;
  let isSelectionModeActive = false;
  let currentHighlightedEl = null;
  let selectionBannerEl = null;
  let toastEl = null;
  let toastTimeout = null;

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
   * Create Shadow DOM Host to completely isolate hover button from page CSS conflicts
   */
  function initShadowHost() {
    if (shadowHost) return;

    shadowHost = document.createElement('div');
    shadowHost.id = 'findly-shadow-host';
    shadowHost.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
    document.documentElement.appendChild(shadowHost);

    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      #findly-hover-pill {
        position: absolute;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 13px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255, 255, 255, 0.22);
        border-radius: 9999px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: -0.01em;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.32), 0 0 12px rgba(168, 85, 247, 0.35);
        cursor: pointer;
        user-select: none;
        opacity: 0;
        pointer-events: none;
        transform: translateY(4px) scale(0.96);
        transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                    background 0.15s ease,
                    border-color 0.15s ease;
      }
      #findly-hover-pill.findly-visible {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }
      #findly-hover-pill:hover {
        background: rgba(15, 23, 42, 0.98);
        border-color: rgba(168, 85, 247, 0.85);
        box-shadow: 0 6px 22px rgba(0, 0, 0, 0.4), 0 0 16px rgba(168, 85, 247, 0.5);
      }
      .findly-pill-icon {
        font-size: 13px;
        line-height: 1;
      }
      .findly-pill-text {
        line-height: 1;
        color: #f8fafc;
        white-space: nowrap;
      }
    `;
    shadowRoot.appendChild(style);

    hoverPillEl = document.createElement('div');
    hoverPillEl.id = 'findly-hover-pill';
    hoverPillEl.innerHTML = `
      <span class="findly-pill-icon">🔍</span>
      <span class="findly-pill-text">Find similar</span>
    `;
    shadowRoot.appendChild(hoverPillEl);

    // Keep pill visible when hovering over the pill itself
    hoverPillEl.addEventListener('mouseenter', () => {
      clearTimeout(pillHideTimeout);
    });

    hoverPillEl.addEventListener('mouseleave', () => {
      hidePill(250);
    });

    hoverPillEl.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (activeImageEl) {
        selectImage(activeImageEl, 'hover');
      }
      hidePill(0);
    });
  }

  /**
   * Determine if an image has sufficient dimensions
   */
  function isImageSufficient(img) {
    if (!img) return false;
    const rect = img.getBoundingClientRect();
    const naturalW = img.naturalWidth || rect.width;
    const naturalH = img.naturalHeight || rect.height;
    return (rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE) ||
           (naturalW >= MIN_IMAGE_SIZE && naturalH >= MIN_IMAGE_SIZE);
  }

  /**
   * Deeply resolve the eligible image element from a Pinterest container, overlay, or img
   */
  function findEligibleImage(el) {
    if (!el || el === shadowHost || shadowHost?.contains(el)) return null;
    if (selectionBannerEl?.contains(el)) return null;

    // 1. Direct <img> check
    if (el.tagName === 'IMG' && isImageSufficient(el)) {
      return el;
    }

    // 2. Check if element has role="img"
    if (el.getAttribute('role') === 'img') {
      const rect = el.getBoundingClientRect();
      if (rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE) {
        return el;
      }
    }

    // 3. Check computed background-image
    try {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none' && bg.startsWith('url(')) {
        const rect = el.getBoundingClientRect();
        if (rect.width >= MIN_IMAGE_SIZE && rect.height >= MIN_IMAGE_SIZE) {
          return el;
        }
      }
    } catch (e) {}

    // 4. Pinterest & Ecommerce Deep Hierarchy Search
    // Walk up up to 8 levels to check parent containers, pin cards, or anchors
    let curr = el;
    for (let i = 0; i < 8 && curr && curr !== document.body && curr !== document.documentElement; i++) {
      // Check if curr is a known pin/product container
      const isPinContainer =
        curr.getAttribute('data-test-id')?.includes('pin') ||
        curr.getAttribute('data-grid-item') === 'true' ||
        curr.getAttribute('role') === 'listitem' ||
        curr.classList?.contains('pin') ||
        curr.tagName === 'ARTICLE' ||
        curr.tagName === 'FIGURE' ||
        (curr.tagName === 'A' && (curr.href?.includes('/pin/') || curr.href?.includes('/p/')));

      if (isPinContainer) {
        const insideImg = curr.querySelector('img');
        if (insideImg && isImageSufficient(insideImg)) {
          return insideImg;
        }
      }

      // Also check if curr has an eligible img inside it
      if (i <= 4) {
        const insideImg = curr.querySelector('img');
        if (insideImg && isImageSufficient(insideImg)) {
          return insideImg;
        }
      }

      curr = curr.parentElement;
    }

    return null;
  }

  /**
   * Extract image URL, base64 data, and sample dominant color from canvas
   */
  function extractImageData(el) {
    let src = '';
    if (el.tagName === 'IMG') {
      src = el.currentSrc || el.src || el.getAttribute('data-src') || '';
    } else {
      const bg = window.getComputedStyle(el).backgroundImage;
      if (bg && bg.startsWith('url(')) {
        const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1]) src = match[1];
      }
    }

    let base64 = null;
    let dominantColor = null;

    if (el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 480;
        let w = el.naturalWidth;
        let h = el.naturalHeight;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(el, 0, 0, w, h);

        try {
          base64 = canvas.toDataURL('image/jpeg', 0.85);
        } catch (corsErr) {}

        try {
          // Color sampling
          const imgData = ctx.getImageData(0, 0, w, h).data;
          let rSum = 0, gSum = 0, bSum = 0, count = 0;
          for (let i = 0; i < imgData.length; i += 16) {
            const r = imgData[i];
            const g = imgData[i + 1];
            const b = imgData[i + 2];
            if ((r > 240 && g > 240 && b > 240) || (r < 25 && g < 25 && b < 25)) continue;
            rSum += r;
            gSum += g;
            bSum += b;
            count++;
          }
          if (count > 0) {
            dominantColor = mapRgbToColorName(rSum / count, gSum / count, bSum / count);
          }
        } catch (sampleErr) {}
      } catch (canvasErr) {}
    }

    return { src, base64, dominantColor };
  }

  function mapRgbToColorName(r, g, b) {
    if (r > 135 && g < 80 && b < 80) return 'Red';
    if (r > 115 && g < 55 && b < 70) return 'Maroon';
    if (r > 170 && g > 90 && g < 150 && b > 120) return 'Pink';
    if (g > r + 25 && g > b + 25) return 'Green';
    if (b > r + 25 && b > g + 15) return 'Blue';
    if (r > 175 && g > 155 && b < 95) return 'Yellow & Gold';
    if (r > 135 && g > 85 && b < 65) return 'Tan Brown';
    if (r < 50 && g < 50 && b < 50) return 'Black';
    if (r > 205 && g > 205 && b > 205) return 'White';
    return 'Multicolor';
  }

  /**
   * Position the hover pill over the active image
   */
  function showPillOver(imgEl) {
    if (!settings.showFindlyButtonOnImages || isSelectionModeActive) return;

    initShadowHost();
    activeImageEl = imgEl;
    clearTimeout(pillHideTimeout);

    const rect = imgEl.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Position 10px inside top-right corner of the actual image
    let top = rect.top + scrollY + 10;
    let left = rect.right + scrollX - 118;

    // Bounds safety
    if (left < scrollX + 10) left = scrollX + 10;
    if (top < scrollY + 10) top = scrollY + 10;

    hoverPillEl.style.top = `${top}px`;
    hoverPillEl.style.left = `${left}px`;
    hoverPillEl.classList.add('findly-visible');
  }

  /**
   * Hide the hover pill with debounce
   */
  function hidePill(delay = 220) {
    clearTimeout(pillHideTimeout);
    pillHideTimeout = setTimeout(() => {
      if (hoverPillEl) {
        hoverPillEl.classList.remove('findly-visible');
      }
      activeImageEl = null;
    }, delay);
  }

  /**
   * In-page feedback notification
   */
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
        <span class="findly-toast-desc">${alt ? (alt.slice(0, 32) + '...') : 'Analyzing silhouette & visual style'}</span>
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
    const { src, base64, dominantColor } = extractImageData(el);
    if (!src && !base64) return;

    const rect = el.getBoundingClientRect();
    const altText = el.getAttribute('alt') || el.getAttribute('title') || '';
    const payload = {
      action: 'FINDLY_IMAGE_SELECTED',
      data: {
        src: src || base64,
        base64,
        dominantColor,
        alt: altText,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        pageTitle: document.title,
        pageUrl: window.location.href,
        mode,
        timestamp: Date.now()
      }
    };

    // Show visual feedback toast on page
    showFeedbackToast(src || base64, altText);

    // Relay through chrome runtime
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(payload, () => {
        if (chrome.runtime.lastError) {
          console.debug('[Findly] Runtime relay note:', chrome.runtime.lastError.message);
        }
      });
    }

    // Flash subtle feedback outline on the selected image
    el.classList.add('findly-image-highlight');
    setTimeout(() => {
      el.classList.remove('findly-image-highlight');
    }, 1000);
  }

  // --- Mode 1 Delegated Hover Listeners ---
  let lastCheckedTarget = null;

  document.addEventListener('mouseover', (e) => {
    if (isSelectionModeActive) return;

    const target = e.target;
    if (target === lastCheckedTarget) return;
    lastCheckedTarget = target;

    const img = findEligibleImage(target);
    if (img) {
      showPillOver(img);
    }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    if (isSelectionModeActive) return;
    const related = e.relatedTarget;
    if (!related || (shadowHost && (related === shadowHost || shadowHost.contains(related)))) {
      return;
    }
    // If mouse left active image and didn't move onto the pill
    if (activeImageEl && !activeImageEl.contains(related) && (!hoverPillEl || !hoverPillEl.contains(related))) {
      hidePill(200);
    }
  }, { passive: true });

  // --- Mode 2 Interactive Selection Mode ---
  function startSelectionMode() {
    if (isSelectionModeActive) return;
    isSelectionModeActive = true;
    hidePill(0);

    document.documentElement.classList.add('findly-selection-active');

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
    const img = findEligibleImage(e.target);
    if (img) {
      if (currentHighlightedEl && currentHighlightedEl !== img) {
        currentHighlightedEl.classList.remove('findly-image-highlight');
      }
      currentHighlightedEl = img;
      currentHighlightedEl.classList.add('findly-image-highlight');
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

    const img = findEligibleImage(e.target);
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      selectImage(img, 'selection');
      exitSelectionMode();
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

  console.log('[Findly] Content script active with Shadow DOM Hover and Selection modes.');
})();
