import { NextResponse } from 'next/server';
import { ImageAnalysis } from '../../../lib/matching';
import { getGoogleLensRawResults, getStoreSearchFallback, SerpApiMatch } from '../../../lib/serpapi';
import { Product } from '../../../lib/dataset';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageSrc, base64, dominantColor, context } = body;

    if (!imageSrc && !base64) {
      return NextResponse.json({ error: 'imageSrc or base64 is required' }, { status: 400 });
    }

    const targetImage = imageSrc || base64;
    let visualMatches: Product[] = [];
    let lensTitles: string[] = [];

    // 1. Try SerpAPI Google Lens if public image URL is available
    if (imageSrc && (imageSrc.startsWith('http://') || imageSrc.startsWith('https://'))) {
      try {
        const { visualMatches: rawMatches, rawData } = await getGoogleLensRawResults(imageSrc);
        if (rawMatches && rawMatches.length > 0) {
          lensTitles = rawMatches.map(m => m.title || '').filter(Boolean);
          
          visualMatches = rawMatches.slice(0, 20).map((match, idx) => {
            const priceNum = match.price?.extracted_value || (1499 + (idx * 200));
            const storeName = detectStore(match.source || match.link || '');
            const validLink = (match.link && !match.link.includes('example.com'))
              ? match.link
              : getStoreSearchFallback(storeName, match.title || 'fashion product');

            return {
              id: `lens_${idx}_${Date.now()}`,
              name: match.title || 'Visual Match Product',
              brand: match.source || storeName,
              category: 'Fashion',
              subcategory: 'Apparel',
              gender: 'Women',
              price: priceNum,
              originalPrice: Math.round(priceNum * 1.35),
              currency: 'INR',
              store: storeName,
              rating: 4.4 + ((idx % 4) * 0.1),
              delivery: '2-4 business days',
              image: match.thumbnail || imageSrc,
              productUrl: validLink,
              color: 'Visual Match',
              material: 'Premium',
              fit: 'Regular',
              silhouette: 'Contemporary',
              length: 'Standard',
              sleeve: 'Standard',
              style: 'Modern',
              tags: ['google-lens', storeName.toLowerCase()],
              matchScore: Math.max(70, 96 - idx)
            };
          });
        }
      } catch (err: any) {
        console.warn('[analyze-image] Google Lens query warning:', err.message);
      }
    }

    // 2. Synthesize all textual signals: Lens titles + alt text + pin title + URL
    const combinedContextText = [
      ...lensTitles,
      context?.alt || '',
      context?.title || '',
      context?.url || '',
      imageSrc || ''
    ].join(' ').toLowerCase();

    // 3. Extract Garment Attributes dynamically
    const analysis = extractAttributes(combinedContextText, dominantColor);

    return NextResponse.json({
      ...analysis,
      visualMatches
    });
  } catch (error: any) {
    console.error('[analyze-image] Route error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}

function detectStore(sourceOrUrl: string): 'Myntra' | 'Amazon' | 'Flipkart' | 'Meesho' {
  const lower = sourceOrUrl.toLowerCase();
  if (lower.includes('myntra')) return 'Myntra';
  if (lower.includes('flipkart')) return 'Flipkart';
  if (lower.includes('meesho')) return 'Meesho';
  return 'Amazon';
}

function extractAttributes(text: string, sampledDominantColor?: string): ImageAnalysis {
  // --- Category & Subcategory ---
  let category = 'Fashion';
  let subcategory = 'Dresses';
  let gender = 'Women';

  if (text.includes('blouse') || text.includes('choli') || text.includes('crop top') || text.includes('corset top')) {
    subcategory = 'Blouses';
    category = 'Fashion';
  } else if (text.includes('saree') || text.includes('sari')) {
    subcategory = 'Sarees';
    category = 'Fashion';
  } else if (text.includes('lehenga') || text.includes('ghagra')) {
    subcategory = 'Lehengas';
    category = 'Fashion';
  } else if (text.includes('kurta') || text.includes('kurti') || text.includes('anarkali') || text.includes('salwar') || text.includes('ethnic')) {
    subcategory = 'Ethnic Wear';
    category = 'Fashion';
  } else if (text.includes('shirt') || text.includes('button down') || text.includes('oxford')) {
    subcategory = 'Shirts';
    category = 'Fashion';
    gender = text.includes('women') ? 'Women' : text.includes('men') ? 'Men' : 'Unisex';
  } else if (text.includes('trench') || text.includes('coat') || text.includes('jacket') || text.includes('blazer')) {
    subcategory = 'Jackets & Coats';
    category = 'Fashion';
  } else if (text.includes('trouser') || text.includes('pant') || text.includes('jeans') || text.includes('slack')) {
    subcategory = 'Trousers';
    category = 'Fashion';
  } else if (text.includes('bag') || text.includes('tote') || text.includes('handbag') || text.includes('purse')) {
    subcategory = 'Bags';
    category = 'Accessories';
  } else if (text.includes('sneaker') || text.includes('shoe') || text.includes('heel') || text.includes('boot')) {
    subcategory = 'Footwear';
    category = 'Accessories';
  } else if (text.includes('watch') || text.includes('chronograph') || text.includes('dial')) {
    subcategory = 'Watches';
    category = 'Accessories';
    gender = 'Unisex';
  } else if (text.includes('skincare') || text.includes('serum') || text.includes('cream')) {
    subcategory = 'Skincare';
    category = 'Beauty';
    gender = 'Unisex';
  } else if (text.includes('lamp') || text.includes('decor') || text.includes('vase')) {
    subcategory = 'Home Decor';
    category = 'Home';
    gender = 'Unisex';
  }

  // --- Dominant Color ---
  let color = sampledDominantColor || 'Red'; // Default red if unstated

  if (text.includes('red') || text.includes('crimson') || text.includes('maroon') || text.includes('ruby') || text.includes('scarlet') || text.includes('burgundy')) {
    color = text.includes('maroon') ? 'Maroon' : text.includes('crimson') ? 'Crimson' : 'Red';
  } else if (text.includes('pink') || text.includes('magenta') || text.includes('rose') || text.includes('blush')) {
    color = 'Pink';
  } else if (text.includes('mint') || text.includes('sage') || text.includes('olive') || text.includes('emerald') || text.includes('green')) {
    color = text.includes('mint') ? 'Pastel Mint' : 'Emerald Green';
  } else if (text.includes('navy') || text.includes('indigo') || text.includes('blue') || text.includes('cyan')) {
    color = text.includes('navy') ? 'Navy Blue' : 'Royal Blue';
  } else if (text.includes('yellow') || text.includes('mustard') || text.includes('gold') || text.includes('ochre')) {
    color = text.includes('gold') ? 'Metallic Gold' : 'Mustard Yellow';
  } else if (text.includes('black') || text.includes('charcoal') || text.includes('ebony')) {
    color = 'Black';
  } else if (text.includes('white') || text.includes('ivory') || text.includes('cream') || text.includes('off-white')) {
    color = 'White';
  } else if (text.includes('tan') || text.includes('camel') || text.includes('brown') || text.includes('beige')) {
    color = 'Tan Brown';
  } else if (text.includes('purple') || text.includes('violet') || text.includes('lavender') || text.includes('plum')) {
    color = 'Purple';
  } else if (text.includes('orange') || text.includes('rust') || text.includes('peach') || text.includes('coral')) {
    color = 'Rust Orange';
  }

  // If sampled color from client canvas is explicitly provided and no strong match in text, use sampled color
  if (sampledDominantColor && (!color || color === 'White')) {
    color = sampledDominantColor;
  }

  // --- Pattern ---
  let pattern = 'Solid';
  if (text.includes('embroider') || text.includes('zari') || text.includes('zardozi') || text.includes('aari') || text.includes('sequin') || text.includes('bead')) {
    pattern = 'Embroidered';
  } else if (text.includes('block print') || text.includes('hand block')) {
    pattern = 'Hand Block Print';
  } else if (text.includes('floral')) {
    pattern = 'Floral Print';
  } else if (text.includes('strip')) {
    pattern = 'Striped';
  } else if (text.includes('check') || text.includes('plaid')) {
    pattern = 'Checked';
  }

  // --- Material ---
  let material = 'Raw Silk';
  if (text.includes('velvet')) {
    material = 'Velvet';
  } else if (text.includes('raw silk') || text.includes('banarasi') || text.includes('silk blend') || text.includes('art silk')) {
    material = 'Raw Silk';
  } else if (text.includes('chanderi')) {
    material = 'Chanderi Silk';
  } else if (text.includes('linen')) {
    material = 'Pure Linen';
  } else if (text.includes('cotton')) {
    material = 'Pure Cotton';
  } else if (text.includes('chiffon') || text.includes('georgette')) {
    material = 'Chiffon & Georgette';
  } else if (text.includes('satin')) {
    material = 'Silk Satin';
  } else if (text.includes('leather')) {
    material = 'Genuine Leather';
  }

  // --- Silhouette & Fit ---
  let fit = 'Regular Fit';
  let silhouette = 'Contemporary Silhouette';
  let length = 'Standard';
  let sleeve = 'Short Sleeve';
  let occasion = 'Festive & Celebration';
  let style = 'Artisanal Ethnic';

  if (subcategory === 'Blouses') {
    fit = 'Fitted';
    silhouette = 'Cropped Blouse';
    length = 'Cropped';
    sleeve = text.includes('elbow') ? 'Elbow Length' : text.includes('sleeveless') ? 'Sleeveless' : text.includes('full') ? 'Full Sleeve' : 'Short Sleeve';
    occasion = 'Bridal & Festive';
    style = 'Traditional Festive';
  } else if (subcategory === 'Dresses') {
    fit = 'Relaxed';
    silhouette = text.includes('wrap') ? 'Midi Wrap' : text.includes('slip') ? 'Column Slip' : 'Fit and Flare';
    length = 'Midi';
    sleeve = text.includes('sleeveless') ? 'Sleeveless' : text.includes('puff') ? 'Puff Sleeve' : 'Short Sleeve';
    occasion = 'Daywear & Vacation';
    style = 'Minimalist Resort';
  } else if (subcategory === 'Ethnic Wear') {
    fit = 'Straight';
    silhouette = 'Kurta Set';
    length = 'Calf Length';
    sleeve = 'Three-Quarter';
    occasion = 'Festive & Office';
    style = 'Artisanal Ethnic';
  } else if (subcategory === 'Bags') {
    fit = 'Structured';
    silhouette = 'Tote Bag';
    length = 'N/A';
    sleeve = 'N/A';
    occasion = 'Work & Daily Travel';
    style = 'Timeless Luxury';
  }

  // Dynamic Visual Tags
  const visualTags = [
    color.toLowerCase(),
    pattern.toLowerCase(),
    subcategory.toLowerCase(),
    material.toLowerCase(),
    silhouette.toLowerCase()
  ].filter((v, i, a) => a.indexOf(v) === i);

  if (subcategory === 'Blouses') {
    visualTags.push('saree blouse', 'bridal wear', 'zari work');
  }

  const estimatedPrice = subcategory === 'Blouses' ? 1899 : subcategory === 'Bags' ? 4499 : 2499;

  return {
    category,
    subcategory,
    gender,
    color,
    pattern,
    material,
    fit,
    silhouette,
    length,
    sleeve,
    style,
    occasion,
    visualTags,
    estimatedPrice
  };
}
