-- Findly Supabase Schema Architecture
-- Target: PostgreSQL / Supabase with Row Level Security (RLS)

-- 1. Users table (linked to supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  preferred_currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products Catalog Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  store TEXT NOT NULL CHECK (store IN ('Myntra', 'Amazon', 'Flipkart', 'Meesho')),
  price NUMERIC NOT NULL,
  original_price NUMERIC,
  currency TEXT DEFAULT 'INR',
  product_url TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  color TEXT,
  material TEXT,
  fit TEXT,
  silhouette TEXT,
  length TEXT,
  sleeve TEXT,
  style TEXT,
  gender TEXT,
  rating NUMERIC DEFAULT 4.0,
  delivery TEXT,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Searches (Visual queries)
CREATE TABLE IF NOT EXISTS public.searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source_image_url TEXT NOT NULL,
  source_page_url TEXT,
  source_page_title TEXT,
  selection_mode TEXT DEFAULT 'hover' CHECK (selection_mode IN ('hover', 'selection', 'sample', 'recent')),
  detected_category TEXT,
  detected_color TEXT,
  detected_material TEXT,
  detected_attributes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Search Results (Ranked results per search)
CREATE TABLE IF NOT EXISTS public.search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES public.searches(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  match_score NUMERIC NOT NULL,
  match_reason TEXT,
  tab_category TEXT DEFAULT 'similar' CHECK (tab_category IN ('exact', 'similar', 'cheaper', 'premium')),
  rank_order INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Saved Products (User bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(user_id, product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);
CREATE INDEX IF NOT EXISTS idx_searches_user ON public.searches(user_id);
CREATE INDEX IF NOT EXISTS idx_search_results_search ON public.search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_saved_products_user ON public.saved_products(user_id);
