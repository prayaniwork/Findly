/**
 * @fileoverview Outbound Ecommerce URL Generator for Findly
 * Ensures store links always resolve to live, browsable search or product pages on Amazon.in, Myntra, Flipkart, and Meesho.
 * Never allows example.com or broken placeholders to open in user tabs.
 */

export function getLiveStoreUrl(product) {
  if (!product) return 'https://www.amazon.in';
  
  const url = product.productUrl || '';
  if (url.startsWith('http') && !url.includes('example.com') && !url.includes('placeholder')) {
    return url;
  }

  const query = encodeURIComponent(product.name || 'fashion apparel');
  const store = (product.store || '').toLowerCase();

  if (store.includes('myntra')) {
    return `https://www.myntra.com/${query}`;
  }
  if (store.includes('flipkart')) {
    return `https://www.flipkart.com/search?q=${query}`;
  }
  if (store.includes('meesho')) {
    return `https://www.meesho.com/search?q=${query}`;
  }
  return `https://www.amazon.in/s?k=${query}`;
}
