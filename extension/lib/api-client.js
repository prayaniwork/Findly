/**
 * @fileoverview API Client for Findly Extension
 * Communicates with Next.js / Vercel API layer with seamless local fallback
 */

import { getSettings } from './storage.js';

export async function fetchWithTimeout(url, options = {}, timeout = 3000) {
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
 * Call backend to analyze image
 */
export async function callBackendAnalyze(imageSrc, context = {}) {
  const settings = await getSettings();
  if (settings.dataSource !== 'backend') {
    return null;
  }

  const endpoint = `${settings.backendUrl || 'http://localhost:3000'}/api/analyze-image`;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageSrc, context })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('[Findly API] Backend unavailable, continuing with local engine');
  }
  return null;
}

/**
 * Call backend to search products
 */
export async function callBackendSearch(query, filters = {}) {
  const settings = await getSettings();
  if (settings.dataSource !== 'backend') {
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
    console.debug('[Findly API] Backend unavailable, continuing with local catalog');
  }
  return null;
}
