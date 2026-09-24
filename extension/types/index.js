/**
 * @fileoverview Type definitions for Findly Chrome Extension
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} brand
 * @property {string} store - 'Myntra' | 'Amazon' | 'Flipkart' | 'Meesho'
 * @property {number} price
 * @property {number} originalPrice
 * @property {string} currency - 'INR'
 * @property {string} image
 * @property {string} productUrl
 * @property {string} category
 * @property {string} subcategory
 * @property {string} color
 * @property {string} material
 * @property {string} fit
 * @property {string} silhouette
 * @property {string} length
 * @property {string} sleeve
 * @property {string} style
 * @property {string} gender
 * @property {number} rating
 * @property {string} delivery
 * @property {string[]} tags
 * @property {Object} [visualAttributes]
 * @property {boolean} [_mock]
 * @property {number} [matchScore]
 * @property {string} [matchReason]
 * @property {string[]} [matchReasons]
 */

/**
 * @typedef {Object} ImageAnalysis
 * @property {string} category
 * @property {string} subcategory
 * @property {string} gender
 * @property {string} color
 * @property {string} pattern
 * @property {string} material
 * @property {string} fit
 * @property {string} silhouette
 * @property {string} length
 * @property {string} sleeve
 * @property {string} style
 * @property {string} occasion
 * @property {string[]} visualTags
 * @property {number} estimatedPrice
 */

/**
 * @typedef {Object} FilterOptions
 * @property {string[]} stores
 * @property {number} minMatchScore
 * @property {number|null} maxPrice
 * @property {number|null} minPrice
 * @property {'best-match'|'price-asc'} sortBy
 */

/**
 * @typedef {Object} ExtensionSettings
 * @property {boolean} showFindlyButtonOnImages
 * @property {boolean} autoOpenSidePanel
 * @property {boolean} enableOnShoppingWebsites
 * @property {'best-match'|'lowest-price'} defaultSort
 * @property {string} currency
 * @property {'local'|'backend'} dataSource
 * @property {string} backendUrl
 */
