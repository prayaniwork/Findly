/**
 * @fileoverview Outbound Ecommerce URL Generator for Findly
 * Ensures store links always resolve to live, browsable product or search pages on Amazon.in, Myntra, Flipkart, and Meesho.
 * Never allows example.com or broken placeholders to open in user tabs.
 */

export function resolveStoreUrl(product) {
  if (!product) return 'https://www.amazon.in';

  if (product.productUrl && typeof product.productUrl === 'string' && product.productUrl.startsWith('http') && !product.productUrl.includes('example.com') && !product.productUrl.includes('placeholder')) {
    return product.productUrl;
  }

  const query = encodeURIComponent(`${product.brand || ''} ${product.name || 'fashion'}`.trim());
  switch (product.store?.toLowerCase()) {
    case 'amazon':
      return `https://www.amazon.in/s?k=${query}`;
    case 'myntra':
      return `https://www.myntra.com/${encodeURIComponent((product.name || 'fashion').replace(/\s+/g, '-'))}`;
    case 'flipkart':
      return `https://www.flipkart.com/search?q=${query}`;
    case 'meesho':
      return `https://www.meesho.com/search?q=${query}`;
    default:
      return `https://www.google.com/search?q=${query}+buy+online`;
  }
}

export const getLiveStoreUrl = resolveStoreUrl;
