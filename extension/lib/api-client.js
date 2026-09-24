/**
 * @fileoverview API Client for Findly Extension
 * Communicates with Next.js / Vercel API layer with seamless local fallback
 */

import { getSettings } from './storage.js';

export async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

function detectStore(sourceOrUrl) {
  const lower = (sourceOrUrl || '').toLowerCase();
  if (lower.includes('myntra')) return 'Myntra';
  if (lower.includes('flipkart')) return 'Flipkart';
  if (lower.includes('meesho')) return 'Meesho';
  return 'Amazon';
}

function getStoreFallbackLink(store, query) {
  const enc = encodeURIComponent(query);
  const s = (store || '').toLowerCase();
  if (s.includes('myntra')) return `https://www.myntra.com/${enc}`;
  if (s.includes('flipkart')) return `https://www.flipkart.com/search?q=${enc}`;
  if (s.includes('meesho')) return `https://www.meesho.com/search?q=${enc}`;
  return `https://www.amazon.in/s?k=${enc}`;
}

/**
 * Direct SerpAPI search when Next.js backend is offline or unreachable
 */
export async function directSerpApiVisualSearch(imageSrc, context = {}) {
  const apiKey = "2752aa851859cbe40f438a9228861a74c1e6cb7a0cf9aaf090c643c5c29cb559";
  let visualMatches = [];

  // 1. Try Google Lens if image is a public HTTP/S URL and not blocked by Pinterest
  if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) && !imageSrc.includes('pinimg.com')) {
    try {
      const url = `https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(imageSrc)}&api_key=${apiKey}&hl=en&country=in`;
      const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
      if (res.ok) {
        const data = await res.json();
        const raw = data.visual_matches || [];
        if (raw.length > 0) {
          visualMatches = raw.slice(0, 20).map((m, idx) => {
            const priceNum = m.price?.extracted_value || (1499 + idx * 200);
            const store = detectStore(m.source || m.link || '');
            const validLink = (m.link && !m.link.includes('example.com')) ? m.link : getStoreFallbackLink(store, m.title || 'fashion');
            return {
              id: `lens_${idx}_${Date.now()}`,
              name: m.title || 'Visual Match Find',
              brand: m.source || store,
              category: 'Fashion',
              subcategory: 'Apparel',
              gender: 'Women',
              price: priceNum,
              originalPrice: Math.round(priceNum * 1.35),
              currency: 'INR',
              store,
              rating: 4.4 + ((idx % 4) * 0.1),
              delivery: '2-4 business days',
              image: m.thumbnail || imageSrc,
              productUrl: validLink,
              color: context.dominantColor || 'Visual Match',
              material: 'Premium',
              fit: 'Regular',
              silhouette: 'Contemporary',
              length: 'Standard',
              sleeve: 'Standard',
              style: 'Modern',
              tags: ['google-lens', store.toLowerCase()],
              matchScore: Math.max(70, 96 - idx)
            };
          });
        }
      }
    } catch (e) {
      console.warn('[Findly API] Direct Google Lens error:', e.message);
    }
  }

  // 2. If Google Lens returned 0 matches or on Pinterest (Akamai 403), query Google Shopping
  if (visualMatches.length === 0) {
    const q = (context.alt || context.title || `${context.dominantColor || ''} fashion apparel`).trim();
    if (q) {
      try {
        const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${apiKey}&gl=in&hl=en`;
        const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
        if (res.ok) {
          const data = await res.json();
          const items = data.shopping_results || [];
          visualMatches = items.slice(0, 20).map((item, idx) => {
            const priceNum = item.extracted_price || 1299;
            const store = detectStore(item.source || item.link || '');
            const validLink = (item.link && !item.link.includes('example.com')) ? item.link : getStoreFallbackLink(store, item.title || q);
            return {
              id: `serp_shop_${idx}_${Date.now()}`,
              name: item.title || q,
              brand: item.source || store,
              category: 'Fashion',
              subcategory: 'Apparel',
              gender: 'Women',
              price: priceNum,
              originalPrice: item.extracted_old_price || Math.round(priceNum * 1.35),
              currency: 'INR',
              store,
              rating: item.rating || 4.4,
              delivery: '2-4 business days',
              image: item.thumbnail || '',
              productUrl: validLink,
              color: context.dominantColor || 'Multicolor',
              material: 'Standard',
              fit: 'Regular',
              silhouette: 'Regular',
              length: 'Standard',
              sleeve: 'Standard',
              style: 'Modern',
              tags: ['google-shopping', store.toLowerCase()],
              matchScore: Math.max(70, 96 - idx)
            };
          });
        }
      } catch (e) {
        console.warn('[Findly API] Direct Google Shopping error:', e.message);
      }
    }
  }

  return visualMatches;
}

/**
 * Call backend to analyze image with real vision pipeline
 */
export async function callBackendAnalyze(imageSrc, context = {}) {
  const settings = await getSettings();
  if (settings.dataSource === 'local-only') {
    return null;
  }

  const endpoint = `${settings.backendUrl || 'http://localhost:3000'}/api/analyze-image`;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageSrc,
        base64: context.base64 || null,
        dominantColor: context.dominantColor || null,
        context: {
          alt: context.alt || '',
          title: context.title || '',
          url: context.url || ''
        }
      })
    }, 7000);

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.debug('[Findly API] Backend analyze unavailable, attempting direct SerpAPI search:', err.message);
  }

  // Seamless fallback: direct SerpAPI search from extension
  try {
    const directMatches = await directSerpApiVisualSearch(imageSrc, context);
    if (directMatches && directMatches.length > 0) {
      return {
        category: 'Fashion',
        subcategory: 'Apparel',
        gender: 'Women',
        color: context.dominantColor || 'Multicolor',
        material: 'Premium',
        fit: 'Regular',
        silhouette: 'Contemporary',
        visualMatches: directMatches
      };
    }
  } catch (err) {
    console.warn('[Findly API] Direct SerpAPI search error:', err.message);
  }

  return null;
}

/**
 * Call backend to match products against query attributes
 */
export async function callBackendMatchProducts(queryAttrs, filters = {}, tab = 'similar', visualMatches = []) {
  const settings = await getSettings();
  if (settings.dataSource === 'local-only') {
    return null;
  }

  const endpoint = `${settings.backendUrl || 'http://localhost:3000'}/api/match-products`;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryAttrs, filters, tab, visualMatches })
    }, 8000);

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('[Findly API] Backend match-products unavailable, continuing with local catalog:', err.message);
  }
  return null;
}

/**
 * Call backend to search products
 */
export async function callBackendSearch(query, filters = {}) {
  const settings = await getSettings();
  if (settings.dataSource === 'local-only') {
    return null;
  }

  const endpoint = `${settings.backendUrl || 'http://localhost:3000'}/api/search-products`;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, filters })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('[Findly API] Backend search unavailable, continuing with local catalog');
  }
  return null;
}
