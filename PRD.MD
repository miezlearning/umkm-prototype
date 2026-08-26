Act as an Expert Frontend Developer and UI/UX Designer specializing in Progressive Web Apps (PWA) and Google's Material Design 3 (M3). 

Your task is to design and develop a modern, minimalist, and highly accessible Point of Sale (PWA) application named "Kasir Mami". The target user is an elderly small business owner (UMKM). The core philosophy is "Effortless UI": extreme ease of use, low cognitive load, large touch targets, and high contrast.

### 1. TECH STACK & ARCHITECTURE
- Frontend: Semantic HTML + Tailwind CSS (via CDN for rapid deployment) + Vanilla JavaScript.
- Design System: Google Material Design 3 (M3) components and principles.
- Database & Storage: Offline-first approach using LocalStorage/IndexedDB for catalog and transaction history. (Future-proof for Supabase/Firebase integration via Fetch API).
- Hosting: Static files optimized for GitHub Pages (Jamstack architecture).

### 2. DESIGN SYSTEM & UI/UX RULES
- Typography: Jakarta Sans. Use M3 `display-large` or `display-medium` for totals and prices. Minimum font size 18px for body text.
- Color Palette (Material You):
  - Primary: Vibrant Deep Teal (#006A67)
  - Secondary/Container: Soft Mint or Soft Orange for high-visibility positive actions.
  - Surface Variant: Clean light gray for product cards.
  - Error/Warning: Clear Red for reset/delete actions.
  - Success: Deep Green for checkout and change calculations.
- Icons: Material Symbols (Rounded style), flat, simple, and easily recognizable.
- Touch Targets: Minimum 48dp x 48dp. Buttons must be large and widely spaced.
- Layout: Modern minimalist split-screen for desktop/tablet, and stacked single-column for mobile.

### 3. APP STRUCTURE & SCREENS TO GENERATE
Please design/generate the following screens:

#### Screen 1: Main POS / Kasir Layout
- Layout: A two-column split layout (Left: Products, Right: Cart).
- Left Column (Product Grid):
  - Top App Bar (Medium): Title "Kasir Mami" with an overflow menu icon on the right.
  - Grid System: A responsive grid displaying products as M3 Filled/Outlined Cards.
  - Each card contains: Material Symbol icon (e.g., ramen_dining, local_drink), bold title (`title-large`), price (`body-large`), and a visual badge showing current quantity in cart.
  - Interaction: Tap 1x adds to cart, tap 2x increases quantity automatically.
- Right Column (Cart & Quick Total Side Sheet):
  - Built inside a Permanent Side Sheet or Surface Container.
  - List of selected items using M3 List Items with prominent trailing (+) and (-) buttons to adjust quantities.
  - Bottom Area: A large elevated container displaying "TOTAL BAYAR" in massive `display-large` typography.
  - Buttons: A full-width M3 Extended FAB labeled "BAYAR SEKARANG" (Primary color) and a secondary Filled Tonal Button labeled "Kosongkan" (Error color).

#### Screen 2: Payment Calculator Modal
- Component: An M3 Full-Screen Dialog.
- Content:
  1. Header: Title "Pembayaran" with a close icon button.
  2. Total Due Banner: M3 Filled Card showing "Total Harus Dibayar" in `display-medium` font.
  3. Quick Cash Selection: Large M3 Filter Chips or Segmented Buttons for common cash amounts (Rp 10.000, Rp 20.000, Rp 50.000, Rp 100.000, and "Uang Pas").
  4. Custom Input: A button labeled "BEBAS..." for custom amounts.
  5. Change Calculation Area: A container showing "Kembalian:" with dynamic calculation rendered in green (Success color) using `display-small` font.
  6. Action Bar: A huge M3 Filled Button labeled "SELESAI & SIMPAN" at the very bottom to clear the cart and return to main screen. Include a smaller "KEMBALI" button on the top left.

#### Screen 3: Product Management (Admin Only)
- Component: A simple table/list view accessible via menu.
- Content: Clear list of all products with columns: Product Name, Price, and Actions (Edit/Delete).
- Actions: A "TAMBAH PRODUK BARU" FAB that opens a simple modal form with fields for "Nama Produk", "Harga", and "Icon/Image Upload". Include a "BACK" button to return to the main POS interface.

### 4. BEHAVIORAL & LOGIC REQUIREMENTS
- Offline First: The app must function 100% without the internet. Data (cart, catalog) must be saved in LocalStorage.
- Kalkulator Kembalian: The system must auto-calculate the change (Cash Received - Total) instantly when a cash button is pressed.
- Reset Flow: Upon completing a transaction, the cart resets cleanly to prepare for the next customer.

### INSTRUCTIONS FOR THE AI:
Based on the structure above, please generate [PILIH: "the complete HTML/Tailwind/Vanilla JS code for Screen 1" OR "the UI components in M3 for Stitch"]. Ensure the code/design is clean, accessible, minimalist, and strictly follows Material Design 3 guidelines.