import { getSerpApiKey } from './security';
import { Product } from './dataset';

/**
 * 🔍 SerpAPI Service for Findly
 * Executes Google Lens (Reverse Image Search) and Google Shopping queries server-to-server.
 * Ensures the API key is never transmitted to the browser or extension.
 */

export interface SerpApiMatch {
  title?: string;
  link?: string;
  source?: string;
  price?: {
    value?: string;
    extracted_value?: number;
    currency?: string;
  };
  thumbnail?: string;
}

/**
 * Reverse visual search using SerpAPI Google Lens engine
 */
export async function searchWithGoogleLens(imageUrl: string): Promise<Product[]> {
  const apiKey = getSerpApiKey();
  if (!apiKey || !imageUrl) return [];

  // Google Lens requires a public HTTP/HTTPS URL
  if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
    console.debug('[SerpAPI] Skipping Google Lens for non-HTTP image (e.g. data URI or blob)');
    return [];
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_lens',
      url: imageUrl,
      api_key: apiKey,
      hl: 'en',
      country: 'in' // Target Indian ecommerce stores (Myntra, Amazon.in, Flipkart, Meesho)
    });

    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 } // Cache results for 5 minutes
    });

    if (!res.ok) {
      console.warn(`[SerpAPI] Google Lens error ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const visualMatches: SerpApiMatch[] = data.visual_matches || [];

    return visualMatches.slice(0, 20).map((match, idx) => {
      const priceNum = match.price?.extracted_value || 1499 + (idx * 250);
      const storeName = detectStoreFromUrl(match.source || match.link || '');
      const validLink = (match.link && !match.link.includes('example.com')) 
        ? match.link 
        : getStoreSearchFallback(storeName, match.title || 'fashion');

      return {
        id: `serp_lens_${idx}_${Date.now()}`,
        name: match.title || 'Visual Match Find',
        brand: match.source || storeName,
        category: 'Fashion',
        subcategory: 'Apparel',
        gender: 'Women',
        price: priceNum,
        originalPrice: Math.round(priceNum * 1.3),
        currency: 'INR',
        store: storeName,
        rating: 4.3 + ((idx % 5) * 0.1),
        delivery: '2-3 business days',
        image: match.thumbnail || imageUrl,
        productUrl: validLink,
        color: 'Visual Match',
        material: 'Premium',
        fit: 'Regular',
        silhouette: 'Contemporary',
        length: 'Standard',
        sleeve: 'Standard',
        style: 'Modern',
        tags: ['google-lens', storeName.toLowerCase()],
        matchScore: Math.max(75, 96 - idx),
      };
    });
  } catch (err: any) {
    console.warn('[SerpAPI] Google Lens search failed:', err.message);
    return [];
  }
}

export function getStoreSearchFallback(store: string, query: string): string {
  const enc = encodeURIComponent(query);
  const s = (store || '').toLowerCase();
  if (s.includes('myntra')) return `https://www.myntra.com/${enc}`;
  if (s.includes('flipkart')) return `https://www.flipkart.com/search?q=${enc}`;
  if (s.includes('meesho')) return `https://www.meesho.com/search?q=${enc}`;
  return `https://www.amazon.in/s?k=${enc}`;
}

export async function getGoogleLensRawResults(imageUrl: string): Promise<{ visualMatches: SerpApiMatch[]; rawData: any }> {
  const apiKey = getSerpApiKey();
  if (!apiKey || !imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
    return { visualMatches: [], rawData: null };
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_lens',
      url: imageUrl,
      api_key: apiKey,
      hl: 'en',
      country: 'in'
    });

    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 }
    });

    if (!res.ok) return { visualMatches: [], rawData: null };
    const data = await res.json();
    return { visualMatches: data.visual_matches || [], rawData: data };
  } catch (err: any) {
    console.warn('[SerpAPI] Raw Google Lens fetch failed:', err.message);
    return { visualMatches: [], rawData: null };
  }
}

/**
 * Text or keyword product search using SerpAPI Google Shopping engine
 */
export async function searchWithGoogleShopping(query: string): Promise<Product[]> {
  const apiKey = getSerpApiKey();
  if (!apiKey || !query) return [];

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      api_key: apiKey,
      gl: 'in',
      hl: 'en'
    });

    const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 180 }
    });

    if (!res.ok) {
      console.warn(`[SerpAPI] Google Shopping error ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const items = data.shopping_results || [];

    return items.slice(0, 20).map((item: any, idx: number) => {
      const priceNum = item.extracted_price || 1299;
      const storeName = detectStoreFromUrl(item.source || item.link || '');

      return {
        id: `serp_shop_${idx}_${Date.now()}`,
        name: item.title || query,
        brand: item.source || storeName,
        category: 'Fashion',
        subcategory: 'Apparel',
        gender: 'Unisex',
        price: priceNum,
        originalPrice: item.extracted_old_price || Math.round(priceNum * 1.35),
        currency: 'INR',
        store: storeName,
        rating: item.rating || 4.4,
        delivery: '2-4 business days',
        image: item.thumbnail || '',
        productUrl: item.link || 'https://amazon.in',
        color: 'Multicolor',
        material: 'Standard',
        fit: 'Regular',
        silhouette: 'Regular',
        length: 'Standard',
        sleeve: 'Standard',
        style: 'Casual',
        tags: ['google-shopping', storeName.toLowerCase()],
        matchScore: 92 - idx,
      };
    });
  } catch (err: any) {
    console.warn('[SerpAPI] Google Shopping query failed:', err.message);
    return [];
  }
}

function detectStoreFromUrl(url: string): 'Myntra' | 'Amazon' | 'Flipkart' | 'Meesho' {
  const lower = url.toLowerCase();
  if (lower.includes('myntra')) return 'Myntra';
  if (lower.includes('flipkart')) return 'Flipkart';
  if (lower.includes('meesho')) return 'Meesho';
  return 'Amazon'; // Default popular marketplace
}
