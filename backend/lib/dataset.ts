import path from 'path';
import fs from 'fs';

export interface Product {
  id: string;
  name: string;
  brand: string;
  store: 'Myntra' | 'Amazon' | 'Flipkart' | 'Meesho';
  price: number;
  originalPrice: number;
  currency: string;
  image: string;
  productUrl: string;
  category: string;
  subcategory: string;
  color: string;
  material: string;
  fit: string;
  silhouette: string;
  length: string;
  sleeve: string;
  style: string;
  gender: string;
  rating: number;
  delivery: string;
  tags: string[];
  matchScore?: number;
  matchReason?: string;
  matchReasons?: string[];
  _mock?: boolean;
}

let cachedProducts: Product[] | null = null;

export function getProductCatalog(): Product[] {
  if (cachedProducts) return cachedProducts;

  try {
    // Look in extension data directory
    const catalogPath = path.resolve(process.cwd(), '../extension/data/products.json');
    if (fs.existsSync(catalogPath)) {
      const data = fs.readFileSync(catalogPath, 'utf-8');
      cachedProducts = JSON.parse(data);
      return cachedProducts!;
    }
  } catch (e) {
    console.error('Error loading product catalog from file, using fallback', e);
  }

  return [];
}
