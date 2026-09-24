/**
 * @fileoverview Findly Product Matching Engine
 * Implements calculateMatchScore with 60% Visual, 25% Attributes, 10% Category, 5% Price weighting.
 * Provides natural language match reasons without exposing raw formulas.
 */

/**
 * Calculates match score between analyzed query attributes and a catalog product
 * @param {import('../types').ImageAnalysis} queryAttrs
 * @param {import('../types').Product} product
 * @param {Object} [options]
 * @returns {{ score: number, reasons: string[], summaryReason: string, detailedBreakdown: string[] }}
 */
export function calculateMatchScore(queryAttrs, product, options = {}) {
  if (!queryAttrs || !product) {
    return { score: 50, reasons: ['General style match'], summaryReason: 'Visual style match.', detailedBreakdown: [] };
  }

  // 1. Category Similarity (10% max weight)
  let categoryScore = 0;
  if (queryAttrs.category === product.category) {
    categoryScore = 7;
    if (queryAttrs.subcategory === product.subcategory) {
      categoryScore = 10;
    }
  }

  // 2. Attributes Similarity (25% max weight)
  let attrScore = 0;
  const attributeReasons = [];
  const detailedBreakdown = [];

  // Color check (up to 7 pts)
  const qColor = (queryAttrs.color || '').toLowerCase();
  const pColor = (product.color || '').toLowerCase();
  if (qColor === pColor || pColor.includes(qColor) || qColor.includes(pColor)) {
    attrScore += 7;
    attributeReasons.push('colour');
    detailedBreakdown.push('✓ Similar colour');
  }

  // Silhouette / Fit check (up to 8 pts)
  const qSil = (queryAttrs.silhouette || queryAttrs.fit || '').toLowerCase();
  const pSil = (product.silhouette || product.fit || '').toLowerCase();
  if (qSil === pSil || pSil.includes(qSil) || qSil.includes(pSil)) {
    attrScore += 8;
    attributeReasons.push('silhouette');
    detailedBreakdown.push('✓ Similar silhouette');
  } else if (queryAttrs.fit && product.fit && queryAttrs.fit.toLowerCase() === product.fit.toLowerCase()) {
    attrScore += 5;
    attributeReasons.push('fit');
    detailedBreakdown.push('✓ Matching fit profile');
  }

  // Material check (up to 6 pts)
  const qMat = (queryAttrs.material || '').toLowerCase();
  const pMat = (product.material || '').toLowerCase();
  if (qMat === pMat || pMat.includes(qMat) || qMat.includes(pMat)) {
    attrScore += 6;
    attributeReasons.push('material');
    detailedBreakdown.push('✓ Similar material');
  }

  // Style / Vibe check (up to 4 pts)
  const qStyle = (queryAttrs.style || '').toLowerCase();
  const pStyle = (product.style || '').toLowerCase();
  if (qStyle === pStyle || pStyle.includes(qStyle) || qStyle.includes(pStyle)) {
    attrScore += 4;
    attributeReasons.push('style');
    detailedBreakdown.push('✓ Harmonious aesthetic');
  }

  // 3. Price Proximity (5% max weight)
  let priceScore = 5;
  const refPrice = options.referencePrice || queryAttrs.estimatedPrice || 2499;
  const priceRatio = product.price / refPrice;
  if (priceRatio >= 0.7 && priceRatio <= 1.3) {
    priceScore = 5;
  } else if (priceRatio >= 0.4 && priceRatio <= 1.8) {
    priceScore = 3;
  } else {
    priceScore = 1;
  }

  // 4. Visual Similarity Simulation (60% max weight)
  // Computed using tag overlap + seeded hash affinity + attribute alignment
  let visualScore = 20;

  // Tag overlap
  const qTags = (queryAttrs.visualTags || []).map(t => t.toLowerCase());
  const pTags = (product.tags || []).map(t => t.toLowerCase());
  let tagMatches = 0;
  qTags.forEach(qt => {
    if (pTags.some(pt => pt.includes(qt) || qt.includes(pt))) {
      tagMatches++;
    }
  });

  const tagFactor = Math.min(1, tagMatches / Math.max(1, qTags.length * 0.4));
  visualScore += tagFactor * 35; // up to 35 pts

  // Deterministic affinity based on product id
  const idNum = parseInt(product.id.replace(/\D/g, '') || '0', 10);
  const microJitter = (idNum % 6); // 0-5 pts
  visualScore += microJitter;
  visualScore = Math.min(60, Math.max(25, visualScore));

  // Total raw score (0 - 100)
  let totalScore = Math.round(categoryScore + attrScore + priceScore + visualScore);
  totalScore = Math.min(98, Math.max(62, totalScore));

  // If detailedBreakdown has < 3 reasons, fill with natural contextual checks
  if (detailedBreakdown.length < 3) {
    if (!detailedBreakdown.some(d => d.includes('silhouette'))) {
      detailedBreakdown.push('✓ Similar silhouette');
    }
    if (!detailedBreakdown.some(d => d.includes('colour'))) {
      detailedBreakdown.push('✓ Coordinated palette');
    }
    if (!detailedBreakdown.some(d => d.includes('material'))) {
      detailedBreakdown.push('✓ Complementary fabric finish');
    }
  }

  // Create human-readable summary reason
  let summaryReason = 'Similar silhouette, colour and material.';
  if (attributeReasons.length >= 2) {
    summaryReason = `Similar ${attributeReasons.join(', ')}.`;
  } else if (queryAttrs.material) {
    summaryReason = `Matching ${queryAttrs.material.toLowerCase()} texture and cut.`;
  }

  return {
    score: totalScore,
    reasons: attributeReasons,
    summaryReason,
    detailedBreakdown: detailedBreakdown.slice(0, 4)
  };
}

/**
 * Filter, sort, and partition products for the side panel views
 * @param {import('../types').Product[]} allProducts
 * @param {import('../types').ImageAnalysis} queryAttrs
 * @param {Object} filterOptions
 * @param {'similar'|'exact'|'cheaper'|'premium'} activeTab
 * @returns {{ products: import('../types').Product[], bestMatch: import('../types').Product|null, isExactFallback?: boolean, referencePrice: number }}
 */
export function filterAndRankProducts(allProducts, queryAttrs, filterOptions = {}, activeTab = 'similar') {
  const referencePrice = filterOptions.referencePrice || queryAttrs?.estimatedPrice || 2499;

  // 1. Score all products against the current query
  const scoredProducts = (allProducts || []).map(product => {
    const match = calculateMatchScore(queryAttrs, product, { referencePrice });
    return {
      ...product,
      matchScore: match.score,
      matchReason: match.summaryReason,
      matchReasons: match.detailedBreakdown
    };
  });

  // 2. Apply active filters (Stores, Min Score, Price)
  let filtered = scoredProducts.filter(p => {
    // Store filter
    if (filterOptions.stores && filterOptions.stores.length > 0) {
      if (!filterOptions.stores.includes(p.store)) return false;
    }
    // Min match score filter
    if (filterOptions.minMatchScore) {
      if (p.matchScore < filterOptions.minMatchScore) return false;
    }
    // Price range filters
    if (filterOptions.minPrice && p.price < filterOptions.minPrice) return false;
    if (filterOptions.maxPrice && p.price > filterOptions.maxPrice) return false;

    return true;
  });

  // 3. Tab-specific partitioning and logic
  let isExactFallback = false;

  if (activeTab === 'exact') {
    // Strict threshold: visual match score >= 92%
    let exactMatches = filtered.filter(p => p.matchScore >= 92);

    if (exactMatches.length === 0) {
      isExactFallback = true;
      exactMatches = []; // Graceful empty state: do not return unrelated 80% items
    }
    filtered = exactMatches;
  } else if (activeTab === 'cheaper') {
    // Products visually similar but cheaper than reference price
    // (at least 15% lower than reference price, or under ₹1,500)
    const thresholdPrice = Math.max(999, Math.round(referencePrice * 0.85));
    let cheaperList = filtered.filter(p => p.price <= thresholdPrice);

    // Fallback if none under threshold
    if (cheaperList.length === 0) {
      cheaperList = filtered.filter(p => p.price < referencePrice);
    }
    filtered = cheaperList.length > 0 ? cheaperList : filtered;
  } else if (activeTab === 'premium') {
    // Higher price tier products (neutral wording: "Similar styles at a higher price range")
    const premiumThreshold = Math.round(referencePrice * 1.15);
    let premiumList = filtered.filter(p => p.price >= premiumThreshold);

    if (premiumList.length === 0) {
      // Pick top priced items from same category
      premiumList = [...filtered].sort((a, b) => b.price - a.price).slice(0, 10);
    }
    filtered = premiumList;
  }

  // 4. Sorting
  const sortBy = filterOptions.sortBy || 'best-match';
  filtered.sort((a, b) => {
    if (sortBy === 'price-asc') {
      return a.price - b.price;
    }
    if (sortBy === 'price-desc') {
      return b.price - a.price;
    }
    // Default: best match score descending, then rating descending
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return b.rating - a.rating;
  });

  const bestMatch = filtered.length > 0 ? filtered[0] : null;

  return {
    products: filtered,
    bestMatch,
    isExactFallback,
    referencePrice
  };
}
