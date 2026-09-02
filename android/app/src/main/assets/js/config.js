/**
 * Kasir Mami - Configuration & Constants
 */

// Default QRIS Statis Merchant (Kedai Usaha Mami - Mandiri Livin')
export const DEFAULT_QRIS_PAYLOAD = '00020101021126690021ID.CO.BANKMANDIRI.WWW01189360000801942889650211719428896580303UMI51440014ID.CO.QRIS.WWW0215ID10254505223350303UMI5204581253033605802ID5916KEDAI USAHA MAMI6015Samarinda (Kota61057511962070703A016304EA56';

export const DEFAULT_STORE_PROFILE = {
  id: 'kedai_usaha_mami',
  name: 'Kedai Usaha Mami',
  city: 'Samarinda (Kota)',
  nmid: 'ID1025450522335',
  acquirer: "Livin' by Mandiri"
};

export const GLOBAL_STORAGE_KEYS = {
  ACTIVE_STORE_ID: 'kasir_active_store_id',
  SAVED_STORES: 'kasir_saved_stores_registry_v1',
  AUTH_ROLE: 'kasir_active_user_role' // 'owner' or 'cashier'
};

// Master Passphrase Tim Teknis / Super-Admin Bypass (Mencegah brute force 4 digit)
export const MASTER_DEV_KEY = 'miez_superdev_2026';

export const DEFAULT_PRINTER_CONFIG = {
  paperWidth: '58mm', // '58mm' atau '80mm'
  printMethod: 'browser', // 'browser', 'bluetooth', 'serial'
  autoPrint: false, // Otomatis cetak begitu bayar selesai
  autoPrintKitchen: false, // Otomatis cetak tiket dapur saat bayar selesai
  autoKickDrawer: true, // Otomatis buka laci kasir saat bayar tunai
  logoBase64: '', // Base64 data logo toko
  showLogo: true, // Tampilkan logo gambar di struk
  cashierName: 'Mami', // Nama kasir yang tampil di struk
  headerStoreName: '', // Jika kosong, pakai nama toko di profil
  headerTagline: '--- SPESIAL RASA NUSANTARA ---',
  headerAddress: 'Samarinda, Kalimantan Timur',
  headerPhone: '081345028895',
  footerSocial: 'Follow IG: @kedai.usaha.mami',
  footerNote: 'Terimakasih telah berkunjung.',
  footerHelp: 'Powered by Aristotle POS',
  showQueueBottom: true, // Tampilkan NO ANTRIAN besar di bagian paling bawah
  feedLines: 3
};

/**
 * Generate isolated localStorage keys per store ID (Multi-Tenant)
 * @param {string} storeId - ID unik toko UMKM
 */
export function getStorageKeys(storeId = 'kedai_usaha_mami') {
  const safeId = (storeId || 'kedai_usaha_mami').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return {
    PRODUCTS: `kasir_${safeId}_products_v1`,
    HISTORY: `kasir_${safeId}_history_v1`,
    QUEUES: `kasir_${safeId}_queues_v1`,
    EXPENSES: `kasir_${safeId}_expenses_v1`,
    QRIS: `kasir_${safeId}_qris_payload_v1`,
    PROFILE: `kasir_${safeId}_profile_v1`,
    AUTH: `kasir_${safeId}_auth_v1`,
    PRINTER: `kasir_${safeId}_printer_v1`
  };
}

export const STORAGE_KEYS = getStorageKeys('kedai_usaha_mami');

export const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Nasi Goreng Spesial', price: 18000, category: 'makanan', icon: 'lunch_dining' },
  { id: 'p2', name: 'Mie Ayam Bakso', price: 15000, category: 'makanan', icon: 'ramen_dining' },
  { id: 'p3', name: 'Ayam Geprek + Nasi', price: 17000, category: 'makanan', icon: 'lunch_dining' },
  { id: 'p4', name: 'Nasi Uduk Komplit', price: 14000, category: 'makanan', icon: 'lunch_dining' },
  { id: 'p5', name: 'Es Teh Manis', price: 5000, category: 'minuman', icon: 'local_drink' },
  { id: 'p6', name: 'Es Jeruk Segar', price: 7000, category: 'minuman', icon: 'local_drink' },
  { id: 'p7', name: 'Kopi Tubruk / Susu', price: 6000, category: 'minuman', icon: 'local_cafe' },
  { id: 'p8', name: 'Gorengan Tempe / Bakwan', price: 2000, category: 'camilan', icon: 'bakery_dining' },
  { id: 'p9', name: 'Pisang Bakar Coklat Keju', price: 12000, category: 'camilan', icon: 'bakery_dining' },
  { id: 'p10', name: 'Tahu Crispy Renyah', price: 10000, category: 'camilan', icon: 'bakery_dining' }
];

export const CATEGORIES = [
  { id: 'all', label: 'Semua', icon: 'apps' },
  { id: 'makanan', label: 'Makanan', icon: 'lunch_dining' },
  { id: 'minuman', label: 'Minuman', icon: 'local_cafe' },
  { id: 'camilan', label: 'Camilan', icon: 'bakery_dining' }
];

