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
    }, 9000);

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    console.debug('[Findly API] Backend analyze unavailable, continuing with dynamic local engine:', err.message);
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
