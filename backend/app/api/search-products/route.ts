import { NextResponse } from 'next/server';
import { getProductCatalog } from '../../../lib/dataset';
import { getCommerceConfig } from '../../../lib/security';
import { searchWithGoogleShopping } from '../../../lib/serpapi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, filters = {} } = body;

    // 🔍 1. Query live Google Shopping results via SerpAPI if configured
    if (query) {
      const shoppingResults = await searchWithGoogleShopping(query);
      if (shoppingResults.length > 0) {
        let filtered = shoppingResults;
        if (filters.stores && filters.stores.length > 0) {
          filtered = filtered.filter(p => filters.stores.includes(p.store));
        }
        if (filters.maxPrice) {
          filtered = filtered.filter(p => p.price <= filters.maxPrice);
        }
        return NextResponse.json({
          source: 'serpapi-google-shopping',
          total: filtered.length,
          products: filtered
        });
      }
    }

    const config = getCommerceConfig();

    // 🔒 If external API is configured, forward query server-to-server
    if (config.isConfigured && query) {
      try {
        const targetUrl = new URL(config.apiUrl);
        targetUrl.searchParams.set('q', query);
        if (filters.category) targetUrl.searchParams.set('category', filters.category);

        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'Findly-Secure-Proxy/1.0',
        };

        if (config.apiKey) {
          headers[config.headerName] = config.apiKey;
        }

        const externalRes = await fetch(targetUrl.toString(), {
          method: 'GET',
          headers,
          next: { revalidate: 30 }
        });

        if (externalRes.ok) {
          const externalData = await externalRes.json();
          const items = Array.isArray(externalData)
            ? externalData
            : (externalData.products || externalData.data || externalData.results || []);

          if (items.length > 0) {
            return NextResponse.json({
              source: 'external-api',
              total: items.length,
              products: items
            });
          }
        }
      } catch (err: any) {
        console.warn('[Findly API] External search query failed, using fallback:', err.message);
      }
    }

    const catalog = getProductCatalog();
    let results = catalog;

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.subcategory.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (filters.stores && filters.stores.length > 0) {
      results = results.filter(p => filters.stores.includes(p.store));
    }

    if (filters.maxPrice) {
      results = results.filter(p => p.price <= filters.maxPrice);
    }

    if (filters.category) {
      results = results.filter(p => p.category.toLowerCase() === filters.category.toLowerCase());
    }

    return NextResponse.json({
      source: 'local-catalog',
      total: results.length,
      products: results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
