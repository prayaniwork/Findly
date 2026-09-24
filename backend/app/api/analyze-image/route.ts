import { NextResponse } from 'next/server';
import { ImageAnalysis } from '../../../lib/matching';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageSrc, context } = body;

    if (!imageSrc) {
      return NextResponse.json({ error: 'imageSrc is required' }, { status: 400 });
    }

    const contextText = `${context?.alt || ''} ${context?.title || ''} ${imageSrc}`.toLowerCase();

    // Deterministic fallback archetypes
    let analysis: ImageAnalysis = {
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
      visualTags: ['white', 'linen', 'midi dress', 'resort', 'minimalist'],
      estimatedPrice: 2199
    };

    if (contextText.includes('bag') || contextText.includes('tote')) {
      analysis = {
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
        visualTags: ['leather tote', 'tan brown', 'laptop bag'],
        estimatedPrice: 4999
      };
    } else if (contextText.includes('watch')) {
      analysis = {
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
        visualTags: ['analog watch', 'chronograph', 'mesh strap'],
        estimatedPrice: 5999
      };
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
