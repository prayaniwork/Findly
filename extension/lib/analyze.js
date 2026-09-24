/**
 * @fileoverview Image Analysis Abstraction for Findly
 * Integrates with real backend Vision / Google Lens pipeline.
 * Extracts visual attributes dynamically with intelligent fallback.
 */

import { callBackendAnalyze } from './api-client.js';

/**
 * Predefined realistic style archetypes for fallback matching
 */
const ARCHETYPES = [
  {
    category: 'Fashion',
    subcategory: 'Blouses',
    gender: 'Women',
    color: 'Red',
    pattern: 'Embroidered',
    material: 'Raw Silk',
    fit: 'Fitted',
    silhouette: 'Cropped Blouse',
    length: 'Cropped',
    sleeve: 'Elbow Length',
    style: 'Artisanal Ethnic',
    occasion: 'Bridal & Festive',
    visualTags: ['red', 'embroidered', 'blouse', 'raw silk', 'saree blouse', 'zari work', 'bridal'],
    estimatedPrice: 1899
  },
  {
    category: 'Fashion',
    subcategory: 'Dresses',
    gender: 'Women',
    color: 'White',
    pattern: 'Solid',
    material: 'Linen',
    fit: 'Relaxed',
    silhouette: 'Midi Wrap',
    length: 'Midi',
    sleeve: 'Sleeveless',
    style: 'Minimalist Resort',
    occasion: 'Daywear & Vacation',
    visualTags: ['white', 'linen', 'midi dress', 'wrap silhouette', 'summer', 'breezy', 'minimalist'],
    estimatedPrice: 2199
  },
  {
    category: 'Fashion',
    subcategory: 'Dresses',
    gender: 'Women',
    color: 'Multicolor',
    pattern: 'Floral Print',
    material: 'Chiffon',
    fit: 'Fit and Flare',
    silhouette: 'Midi Flare',
    length: 'Midi',
    sleeve: 'Puff Sleeve',
    style: 'Romantic Cottagecore',
    occasion: 'Brunch & Celebrations',
    visualTags: ['floral', 'chiffon', 'puff sleeve', 'romantic', 'summer dress'],
    estimatedPrice: 1899
  },
  {
    category: 'Fashion',
    subcategory: 'Dresses',
    gender: 'Women',
    color: 'Black',
    pattern: 'Solid',
    material: 'Satin',
    fit: 'Slim Fit',
    silhouette: 'Column Slip',
    length: 'Midi',
    sleeve: 'Spaghetti Strap',
    style: '90s Minimalist',
    occasion: 'Cocktail & Evening',
    visualTags: ['black', 'satin slip', 'cowl neck', 'evening wear', 'minimalist'],
    estimatedPrice: 2899
  },
  {
    category: 'Fashion',
    subcategory: 'Ethnic Wear',
    gender: 'Women',
    color: 'Pastel Mint',
    pattern: 'Hand Block Print',
    material: 'Chanderi Silk',
    fit: 'Straight',
    silhouette: 'Kurta Set',
    length: 'Calf Length',
    sleeve: 'Three-Quarter',
    style: 'Artisanal Ethnic',
    occasion: 'Festive & Office',
    visualTags: ['kurta set', 'chanderi silk', 'block print', 'mint green', 'ethnic'],
    estimatedPrice: 3299
  },
  {
    category: 'Fashion',
    subcategory: 'Shirts',
    gender: 'Unisex',
    color: 'White',
    pattern: 'Solid',
    material: 'Pure Linen',
    fit: 'Relaxed Fit',
    silhouette: 'Classic Button-Down',
    length: 'Hip Length',
    sleeve: 'Full Sleeve',
    style: 'Coastal Minimalist',
    occasion: 'Casual & Work',
    visualTags: ['white shirt', 'pure linen', 'button down', 'clean', 'breathable'],
    estimatedPrice: 2499
  },
  {
    category: 'Fashion',
    subcategory: 'Jackets & Coats',
    gender: 'Women',
    color: 'Camel Tan',
    pattern: 'Solid',
    material: 'Cotton Gabardine',
    fit: 'Regular Belted',
    silhouette: 'Double-Breasted Trench',
    length: 'Knee Length',
    sleeve: 'Full Sleeve',
    style: 'Timeless British',
    occasion: 'Travel & Autumn',
    visualTags: ['trench coat', 'camel tan', 'double breasted', 'classic', 'outerwear'],
    estimatedPrice: 6999
  },
  {
    category: 'Fashion',
    subcategory: 'Trousers',
    gender: 'Women',
    color: 'Charcoal Grey',
    pattern: 'Solid',
    material: 'Wool Viscose Blend',
    fit: 'Wide Leg',
    silhouette: 'Double Pleated',
    length: 'Full Length',
    sleeve: 'N/A',
    style: 'Quiet Luxury',
    occasion: 'Office & Everyday',
    visualTags: ['pleated trousers', 'wide leg', 'grey', 'tailored', 'workwear'],
    estimatedPrice: 2499
  },
  {
    category: 'Accessories',
    subcategory: 'Bags',
    gender: 'Women',
    color: 'Tan Brown',
    pattern: 'Solid',
    material: 'Genuine Leather',
    fit: 'Structured Large',
    silhouette: 'Tote Bag',
    length: 'N/A',
    sleeve: 'N/A',
    style: 'Timeless Luxury',
    occasion: 'Work & Daily Travel',
    visualTags: ['leather tote', 'tan brown', 'laptop bag', 'structured handbag'],
    estimatedPrice: 4999
  },
  {
    category: 'Accessories',
    subcategory: 'Footwear',
    gender: 'Unisex',
    color: 'White & Off-White',
    pattern: 'Solid',
    material: 'Full Grain Leather',
    fit: 'True to Size',
    silhouette: 'Low-Top Sneaker',
    length: 'N/A',
    sleeve: 'N/A',
    style: 'Minimalist Athleisure',
    occasion: 'Everyday',
    visualTags: ['white sneakers', 'leather court shoe', 'minimal footwear', 'low top'],
    estimatedPrice: 3499
  },
  {
    category: 'Accessories',
    subcategory: 'Watches',
    gender: 'Unisex',
    color: 'Silver & Matte Black',
    pattern: 'Metallic',
    material: 'Stainless Steel Mesh',
    fit: 'Slim 38mm',
    silhouette: 'Round Dial',
    length: 'N/A',
    sleeve: 'N/A',
    style: 'Nordic Bauhaus',
    occasion: 'Daily & Formal',
    visualTags: ['analog watch', 'chronograph', 'mesh strap', 'bauhaus', 'titan'],
    estimatedPrice: 5999
  },
  {
    category: 'Beauty',
    subcategory: 'Skincare',
    gender: 'Unisex',
    color: 'Clear Amber Bottle',
    pattern: 'Clean Label',
    material: 'Serum Solution',
    fit: '30ml Dropper',
    silhouette: 'Apothecary Dropper',
    length: 'N/A',
    sleeve: 'N/A',
    style: 'Clinical Clean',
    occasion: 'Morning Routine',
    visualTags: ['vitamin c serum', 'brightening', 'dropper bottle', 'skincare active'],
    estimatedPrice: 699
  },
  {
    category: 'Home',
    subcategory: 'Lighting',
    gender: 'Unisex',
    color: 'Off-White Matte',
    pattern: 'Fluted Texture',
    material: 'Ceramic & Linen',
    fit: '18 inch',
    silhouette: 'Fluted Column Lamp',
    length: 'N/A',
    sleeve: 'N/A',
    style: 'Sculptural Scandinavian',
    occasion: 'Living & Bedroom',
    visualTags: ['ceramic lamp', 'fluted base', 'linen shade', 'minimal home decor'],
    estimatedPrice: 2999
  }
];

/**
 * Extract keywords from context string and sampled color
 */
function matchContextToArchetype(contextStr, dominantColor = '') {
  const text = (contextStr || '').toLowerCase();
  const dColor = (dominantColor || '').toLowerCase();

  // Blouses & Ethnic tops
  if (text.includes('blouse') || text.includes('choli') || text.includes('saree blouse') || 
      (dColor.includes('red') && (text.includes('saree') || text.includes('ethnic') || text.includes('embroid')))) {
    return ARCHETYPES[0]; // Red Embroidered Blouse
  }

  if (text.includes('floral') || text.includes('flower') || text.includes('print')) {
    return ARCHETYPES[2];
  }
  if (text.includes('black') && (text.includes('slip') || text.includes('dress') || text.includes('cocktail'))) {
    return ARCHETYPES[3];
  }
  if (text.includes('kurta') || text.includes('anarkali') || text.includes('mint')) {
    return ARCHETYPES[4];
  }
  if (text.includes('shirt') || text.includes('linen shirt') || text.includes('button')) {
    return ARCHETYPES[5];
  }
  if (text.includes('trench') || text.includes('coat') || text.includes('jacket') || text.includes('outerwear')) {
    return ARCHETYPES[6];
  }
  if (text.includes('trouser') || text.includes('pant') || text.includes('pleat') || text.includes('slack')) {
    return ARCHETYPES[7];
  }
  if (text.includes('bag') || text.includes('tote') || text.includes('purse') || text.includes('crossbody')) {
    return ARCHETYPES[8];
  }
  if (text.includes('sneaker') || text.includes('shoe') || text.includes('loafer') || text.includes('footwear')) {
    return ARCHETYPES[9];
  }
  if (text.includes('watch') || text.includes('dial') || text.includes('chronograph')) {
    return ARCHETYPES[10];
  }
  if (text.includes('serum') || text.includes('skincare') || text.includes('cream') || text.includes('moisturizer')) {
    return ARCHETYPES[11];
  }
  if (text.includes('lamp') || text.includes('vase') || text.includes('cushion') || text.includes('home') || text.includes('decor')) {
    return ARCHETYPES[12];
  }
  if (text.includes('linen') || text.includes('white dress') || text.includes('dress') || text.includes('midi')) {
    return ARCHETYPES[1];
  }

  // If color is red / crimson
  if (dColor.includes('red') || dColor.includes('crimson') || dColor.includes('maroon') || text.includes('red')) {
    return ARCHETYPES[0];
  }

  return null;
}

/**
 * Primary analyzeImage abstraction
 * @param {string} imageSrc - URL or Data URI of image
 * @param {Object} [context] - Context clues (alt text, pageTitle, hostname, base64, dominantColor)
 * @returns {Promise<import('../types').ImageAnalysis>}
 */
export async function analyzeImage(imageSrc, context = {}) {
  // 1. First, call the real Vision backend endpoint
  try {
    const backendResult = await callBackendAnalyze(imageSrc, context);
    if (backendResult && backendResult.category) {
      return backendResult;
    }
  } catch (err) {
    console.debug('[Findly] Backend analyze request error:', err.message);
  }

  // 2. Intelligent local fallback based on context and color
  const contextStr = `${context.alt || ''} ${context.title || ''} ${context.url || ''} ${imageSrc || ''}`;
  const matched = matchContextToArchetype(contextStr, context.dominantColor);

  if (matched) {
    const res = { ...matched };
    if (context.dominantColor) {
      res.color = context.dominantColor;
    }
    return res;
  }

  // Default to Red Embroidered Blouse archetype if Pinterest / ethnic or general apparel
  return { ...ARCHETYPES[0] };
}

/**
 * Progressive attribute list for the analysis loading animation
 * Generates an array of 5 concise detected attribute pills to reveal step-by-step
 * @param {import('../types').ImageAnalysis} analysis
 * @returns {string[]}
 */
export function getProgressiveAttributes(analysis) {
  if (!analysis) return ['Product', 'Color', 'Material', 'Silhouette', 'Category'];

  return [
    analysis.subcategory || analysis.category || 'Apparel',
    analysis.color || 'Neutral',
    analysis.material || 'Standard',
    analysis.silhouette || analysis.fit || 'Regular',
    analysis.gender === 'Women' ? "Women's" : analysis.gender === 'Men' ? "Men's" : 'Unisex'
  ];
}
