import { NextResponse } from 'next/server';
import { getProductCatalog, Product } from '../../../lib/dataset';
import { calculateMatchScore, ImageAnalysis } from '../../../lib/matching';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { queryAttrs, filters = {}, tab = 'similar', visualMatches = [] } = body;

    if (!queryAttrs) {
      return NextResponse.json({ error: 'queryAttrs are required' }, { status: 400 });
    }

    const catalog = getProductCatalog();
    // Merge live Google Lens visual matches with catalog
    const allProducts: Product[] = [...(visualMatches || []), ...catalog];
    const referencePrice = queryAttrs.estimatedPrice || 2499;

    let scored = allProducts.map(product => {
      const match = calculateMatchScore(queryAttrs as ImageAnalysis, product, { referencePrice });
      return {
        ...product,
        matchScore: product.matchScore ? Math.max(product.matchScore, match.score) : match.score,
        matchReason: match.summaryReason,
        matchReasons: match.detailedBreakdown
      };
    });

    // Apply store filter
    if (filters.stores && filters.stores.length > 0) {
      scored = scored.filter(p => filters.stores.includes(p.store));
    }

    // Tab logic
    let isExactFallback = false;
    if (tab === 'exact') {
      // Strict threshold: >= 92% visual match
      let exact = scored.filter(p => (p.matchScore || 0) >= 92);
      if (exact.length === 0) {
        isExactFallback = true;
        exact = []; // Strict: do not show unrelated 80% items as exact matches
      }
      scored = exact;
    } else if (tab === 'cheaper') {
      const cheaperCap = Math.max(999, Math.round(referencePrice * 0.8));
      let cheaper = scored.filter(p => p.price <= cheaperCap);
      if (cheaper.length > 0) scored = cheaper;
    } else if (tab === 'premium') {
      const premFloor = Math.round(referencePrice * 1.2);
      let premium = scored.filter(p => p.price >= premFloor);
      if (premium.length > 0) scored = premium;
    }

    // Sort
    scored.sort((a, b) => {
      if (filters.sortBy === 'price-asc') return a.price - b.price;
      return (b.matchScore || 0) - (a.matchScore || 0);
    });

    const bestMatch = scored.length > 0 ? scored[0] : null;

    return NextResponse.json({
      total: scored.length,
      bestMatch,
      products: scored,
      isExactFallback,
      referencePrice
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Matching failed' }, { status: 500 });
  }
}
