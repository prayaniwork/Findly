import { NextResponse } from 'next/server';
import { getProductCatalog } from '../../../lib/dataset';
import { getCommerceConfig } from '../../../lib/security';
import { searchWithGoogleLens } from '../../../lib/serpapi';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const store = searchParams.get('store');
    const imageUrl = searchParams.get('imageUrl');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 🔍 1. If an image URL is supplied, perform Google Lens reverse visual search via SerpAPI
    if (imageUrl) {
      const lensResults = await searchWithGoogleLens(imageUrl);
      if (lensResults.length > 0) {
        return NextResponse.json({
          source: 'serpapi-google-lens',
          total: lensResults.length,
          products: lensResults.slice(0, limit)
        });
      }
    }

    const config = getCommerceConfig();

    // 🔒 If an external API URL is configured in .env.local, fetch securely server-to-server
    if (config.isConfigured) {
      try {
        const targetUrl = new URL(config.apiUrl);
        if (category) targetUrl.searchParams.set('category', category);
        if (store) targetUrl.searchParams.set('store', store);
        targetUrl.searchParams.set('limit', String(limit));

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
          next: { revalidate: 60 } // Cache for 60 seconds
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
              products: items.slice(0, limit)
            });
          }
        }
        console.warn('[Findly API] External API returned non-OK or empty, using fallback catalog');
      } catch (externalErr: any) {
        console.warn('[Findly API] External API request failed, using fallback catalog:', externalErr.message);
      }
    }

    // Default: local verified product catalog
    let catalog = getProductCatalog();

    if (category) {
      catalog = catalog.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (store) {
      catalog = catalog.filter(p => p.store.toLowerCase() === store.toLowerCase());
    }

    return NextResponse.json({
      source: 'local-catalog',
      total: catalog.length,
      products: catalog.slice(0, limit)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch products' }, { status: 500 });
  }
}
