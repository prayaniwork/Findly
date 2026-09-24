# Findly — Visual Shopping Assistant (Chrome Extension MV3)

Findly is a production-grade visual shopping assistant Chrome Extension built with **Manifest V3**. It works seamlessly while users browse the web, allowing them to spot any product imagery, select it via subtle hover or interactive selection mode, and instantly discover exact, similar, cheaper, and premium matches right inside the **Chrome Side Panel**.

---

## 🌟 Key Features

- **Mode 1 — Subtle Hover Action**: Hover over any eligible product image on any webpage (Pinterest, Myntra, Amazon, Flipkart, Meesho, or generic sites) to reveal a sleek floating **🔍 Find similar** pill.
- **Mode 2 — Interactive Selection Mode**: Click **"Select an item"** from the extension popup or side panel to highlight hovered images with a subtle purple glow and click to inspect (Press `Esc` to cancel).
- **Chrome Side Panel Primary UI**: Stays docked alongside your browsing window (360px–480px responsive), allowing side-by-side visual comparison without leaving the current tab.
- **9 Polished UI States**:
  1. **Idle**: Visual welcoming state with quick categories and primary CTA.
  2. **Image Selected**: Prominent preview with change/remove actions.
  3. **Analyzing**: Polished progressive attribute breakdown (*Dress* → *White* → *Linen* → *Midi* → *Women's*).
  4. **Searching**: Smooth transition into product query execution.
  5. **Results**: Closest match card with 96% match badge + 2-column similar finds grid.
  6. **Product Detail**: In-depth view with "Why this matches" attribute breakdown, store pricing, and external tab link.
  7. **Compare Drawer & View**: Side-by-side comparison table of up to 3 products (Price, Match Score, Material, Color, Rating, Store).
  8. **My Finds**: Locally persisted bookmarks via Chrome Storage.
  9. **Settings & Feedback**: Customization toggles (hover button, auto-open, INR currency, default sort).
- **Categorized Results Tabs**:
  - **Similar**: Best match card + 2-column grid.
  - **Exact**: Identical matches or closest alternatives fallback.
  - **Cheaper**: *"Same vibe. Less money"* with original reference price comparison and items under target budget.
  - **Premium**: Curated higher-tier designer & boutique alternatives with neutral, tasteful language.
- **Transparent 4-Factor Matching Engine**:
  - Visual similarity: 60%
  - Attributes similarity: 25% (silhouette, material, color, pattern, style)
  - Category match: 10%
  - Price proximity: 5%
  - Displays natural language match explanations (e.g. *"Similar silhouette, colour and material"*).
- **115+ Curated Indian Products**: Realistic catalog across Fashion, Accessories, Beauty, and Home for Myntra, Amazon, Flipkart, and Meesho in INR (₹).
- **Next.js & Supabase Ready API**: Companion backend layer with REST endpoints and Supabase database schema.

---

## 📁 Repository Structure

```
Findly- chrome extension/
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── manifest.json                # MV3 manifest configuration
│   ├── icons/                       # Extension icons (16, 32, 48, 128px)
│   ├── background/
│   │   └── background.js            # Background service worker (SidePanel API, tabs)
│   ├── content/
│   │   ├── content.js               # Hover pill & interactive selection mode
│   │   └── content.css              # Subtle, non-intrusive floating styles
│   ├── sidepanel/
│   │   ├── sidepanel.html           # 9-state responsive side panel markup
│   │   ├── sidepanel.css            # Luxury editorial e-commerce styling
│   │   └── sidepanel.js             # State machine, matching, filters, compare
│   ├── popup/
│   │   ├── popup.html               # Compact toolbar popup
│   │   ├── popup.css                # Toolbar styling
│   │   └── popup.js                 # Trigger selection & recent searches
│   ├── lib/
│   │   ├── analyze.js               # Vision analysis abstraction & progressive tags
│   │   ├── match.js                 # calculateMatchScore() & tab filters
│   │   ├── storage.js               # Chrome Storage API wrapper with fallback
│   │   ├── analytics.js             # Placeholder telemetry events
│   │   └── api-client.js            # Backend API communication client
│   ├── types/
│   │   └── index.js                 # JSDoc type definitions
│   └── data/
│       └── products.json            # 115+ curated items across Myntra, Amazon, Flipkart, Meesho
├── backend/                         # Next.js 14 API Layer (Vercel & Supabase Ready)
│   ├── app/api/
│   │   ├── analyze-image/route.ts   # POST /api/analyze-image
│   │   ├── search-products/route.ts # POST /api/search-products
│   │   ├── match-products/route.ts  # POST /api/match-products
│   │   └── products/route.ts        # GET /api/products
│   ├── lib/
│   │   ├── matching.ts              # Backend matching engine
│   │   └── dataset.ts               # Dataset loader
│   ├── supabase/
│   │   └── schema.sql               # Supabase tables & indexes
│   └── next.config.js               # CORS headers enabled for extension
└── test-page/                       # Interactive local test environment
    ├── index.html                   # Pinterest & fashion moodboard feed
    └── style.css                    # Responsive gallery styling
```

---

## 🚀 How to Load and Test the Extension in Chrome

### Step 1: Load the Unpacked Extension in Chrome
1. Open Google Chrome.
2. In the URL bar, navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (top-left).
5. Select the **`extension/`** folder inside this repository:
   ```
   /Users/prayanipohekar/Findly- chrome extension/extension
   ```
6. Findly will appear with its icon and permissions configured.

---

### Step 2: Test with the Included Test Page
1. Open the local testbed page in Chrome:
   - Either double click `test-page/index.html` to open it as `file://.../test-page/index.html`
   - Or serve it using any local HTTP server:
     ```bash
     npx serve test-page
     ```
2. **Mode 1 (Hover Action)**:
   - Hover your mouse over any image (e.g. White Linen Dress, Leather Tote, Bauhaus Watch).
   - Notice the subtle floating **🔍 Find similar** pill appearing at the top right of the image.
   - Click it. The Chrome Side Panel opens on the right.
   - Watch the progressive attribute reveal (*Dresses* → *White* → *Linen* → *Midi Wrap* → *Women's*).
   - View the ranked matches with the **Best Match** card on top and the **Similar finds** 2-column grid below.
3. **Tab Exploration**:
   - Click **Exact**: Shows identical or near-identical items (with graceful fallback if unavailable).
   - Click **Cheaper**: Shows *"Same vibe. Less money"* with reference price comparison (e.g. items under ₹1,500).
   - Click **Premium**: Shows designer and boutique alternatives at higher price tiers.
4. **Compare Products**:
   - Hover over cards and click **+ Compare** on up to 3 items.
   - The floating comparison dock appears at the bottom.
   - Click **Compare** to view the full side-by-side comparison table (Price, Match Score, Material, Color, Category, Rating, Store).
5. **Product Detail**:
   - Click any product title or image to open the full detail view.
   - Review the **"Why this matches"** attribute checks (✓ Similar colour, ✓ Similar silhouette, ✓ Similar material).
   - Click **View product** to open the product URL in a new browser tab.
6. **Save to My Finds**:
   - Click the bookmark icon on any card or in detail view.
   - Open **My Finds** from the header to see your saved items persisted across sessions.
7. **Mode 2 (Selection Mode)**:
   - Click the Findly toolbar icon or the crosshair icon in the side panel header.
   - A top banner will display: *"Select any product image on this page"*.
   - Move your cursor over images; they will highlight with an accent outline.
   - Click any image to immediately analyze it, or press `Esc` to cancel.

---

## 🛠️ Running the Next.js API Layer (Optional)

The extension functions 100% offline out-of-the-box using the built-in catalog and matching engine. If you want to run the separate backend API:

```bash
cd backend
npm install
npm run dev
```

The API will be available at `http://localhost:3000`. In the side panel's **Settings**, switch the **Data source** from *Local Catalog* to *Next.js API Layer*.

### Available Backend Endpoints:
- `POST /api/analyze-image`: Analyzes visual attributes from image payload.
- `POST /api/search-products`: Searches products by keyword, category, and store.
- `POST /api/match-products`: Computes ranked match scores against catalog.
- `GET /api/products`: Lists products with filtering and pagination.

---

## 🔒 Security & Privacy

- Images are processed locally by default.
- No third-party tracking scripts or browsing history collection.
- Only images explicitly clicked or selected by the user are analyzed.
