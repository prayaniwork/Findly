/**
 * @fileoverview Placeholder Analytics Tracking Module for Findly
 * Does not transmit data to external 3rd parties. Logs structured events internally.
 */

const IS_DEV = true;

function logEvent(eventName, payload = {}) {
  const timestamp = new Date().toISOString();
  if (IS_DEV) {
    console.debug(`[Findly Analytics] ${eventName}`, { timestamp, ...payload });
  }
}

export function trackExtensionActivated() {
  logEvent('extension_activated');
}

export function trackImageSelected(imageDetails) {
  logEvent('image_selected', {
    hasAlt: Boolean(imageDetails?.alt),
    srcDomain: imageDetails?.src ? new URL(imageDetails.src, window.location.href).hostname : 'unknown',
    width: imageDetails?.width,
    height: imageDetails?.height,
    mode: imageDetails?.mode || 'hover'
  });
}

export function trackAnalysisCompleted(attributes) {
  logEvent('analysis_completed', {
    category: attributes?.category,
    color: attributes?.color,
    material: attributes?.material,
    tagsCount: attributes?.visualTags?.length || 0
  });
}

export function trackResultsViewed(details) {
  logEvent('results_viewed', {
    totalMatches: details?.totalMatches,
    activeTab: details?.activeTab,
    topMatchScore: details?.topMatchScore
  });
}

export function trackProductViewed(product) {
  logEvent('product_viewed', {
    productId: product?.id,
    store: product?.store,
    category: product?.category,
    price: product?.price
  });
}

export function trackProductSaved(product) {
  logEvent('product_saved', {
    productId: product?.id,
    store: product?.store,
    name: product?.name
  });
}

export function trackCompareOpened(products) {
  logEvent('compare_opened', {
    count: products?.length,
    productIds: products?.map(p => p.id)
  });
}

export function trackStoreClicked(product) {
  logEvent('store_clicked', {
    productId: product?.id,
    store: product?.store,
    price: product?.price,
    url: product?.productUrl
  });
}
