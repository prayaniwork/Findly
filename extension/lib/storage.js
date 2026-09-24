/**
 * @fileoverview Chrome Storage Wrapper with localStorage fallback for testing
 */

const DEFAULT_SETTINGS = {
  showFindlyButtonOnImages: true,
  autoOpenSidePanel: true,
  enableOnShoppingWebsites: true,
  defaultSort: 'best-match',
  currency: 'INR',
  dataSource: 'backend',
  backendUrl: 'http://localhost:3000'
};

const STORAGE_KEYS = {
  SETTINGS: 'findly_settings',
  SAVED_PRODUCTS: 'findly_saved_products',
  RECENT_SEARCHES: 'findly_recent_searches',
  ACTIVE_SEARCH: 'findly_active_search'
};

/**
 * Check if running within a valid Chrome Extension storage context
 */
function isChromeStorageAvailable() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

/**
 * Get item from storage
 */
async function getItem(key, defaultValue = null) {
  if (isChromeStorageAvailable()) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (e) {
      console.warn('[Findly Storage] Chrome storage get failed, falling back to localStorage', e);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

/**
 * Set item in storage
 */
async function setItem(key, value) {
  if (isChromeStorageAvailable()) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return;
    } catch (e) {
      console.warn('[Findly Storage] Chrome storage set failed, falling back to localStorage', e);
    }
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error('[Findly Storage] Error saving to localStorage', err);
  }
}

// Settings methods
export async function getSettings() {
  const stored = await getItem(STORAGE_KEYS.SETTINGS, {});
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await setItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// Saved Products methods
export async function getSavedProducts() {
  return await getItem(STORAGE_KEYS.SAVED_PRODUCTS, []);
}

export async function saveProduct(product) {
  if (!product || !product.id) return [];
  const list = await getSavedProducts();
  const exists = list.some(p => p.id === product.id);
  if (!exists) {
    const updated = [
      {
        ...product,
        savedAt: new Date().toISOString()
      },
      ...list
    ];
    await setItem(STORAGE_KEYS.SAVED_PRODUCTS, updated);
    return updated;
  }
  return list;
}

export async function removeSavedProduct(productId) {
  const list = await getSavedProducts();
  const updated = list.filter(p => p.id !== productId);
  await setItem(STORAGE_KEYS.SAVED_PRODUCTS, updated);
  return updated;
}

export async function isProductSaved(productId) {
  const list = await getSavedProducts();
  return list.some(p => p.id === productId);
}

// Recent Searches
export async function getRecentSearches() {
  return await getItem(STORAGE_KEYS.RECENT_SEARCHES, []);
}

export async function addRecentSearch(searchData) {
  if (!searchData || !searchData.imageSrc) return [];
  const list = await getRecentSearches();

  const newEntry = {
    id: `search_${Date.now()}`,
    imageSrc: searchData.imageSrc,
    queryLabel: searchData.queryLabel || 'Product search',
    detectedCategory: searchData.detectedCategory || 'Item',
    matchesCount: searchData.matchesCount || 0,
    timestamp: Date.now()
  };

  // Keep top 6 most recent, avoid duplicate imageSrc
  const filtered = list.filter(item => item.imageSrc !== searchData.imageSrc);
  const updated = [newEntry, ...filtered].slice(0, 6);
  await setItem(STORAGE_KEYS.RECENT_SEARCHES, updated);
  return updated;
}

export async function clearRecentSearches() {
  await setItem(STORAGE_KEYS.RECENT_SEARCHES, []);
  return [];
}

// Active Search (State persistence across panel closes)
export async function getActiveSearch() {
  return await getItem(STORAGE_KEYS.ACTIVE_SEARCH, null);
}

export async function setActiveSearch(activeSearchData) {
  await setItem(STORAGE_KEYS.ACTIVE_SEARCH, activeSearchData);
}

export async function clearActiveSearch() {
  await setItem(STORAGE_KEYS.ACTIVE_SEARCH, null);
}
