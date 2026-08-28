/**
 * Kasir Mami - Configuration & Constants
 */

export const STORAGE_KEYS = {
  PRODUCTS: 'kasir_mami_products_v1',
  HISTORY: 'kasir_mami_history_v1',
  QUEUES: 'kasir_mami_queues_v1',
  EXPENSES: 'kasir_mami_expenses_v1',
  QRIS: 'kasir_mami_qris_payload_v1'
};

// Default QRIS Statis Merchant (Kedai Mami Berkah)
export const DEFAULT_QRIS_PAYLOAD = '00020101021126590014ID.GO.GPN.WWW01189360091400000000000215000000000000000051440014ID.CO.QRIS.WWW02150000000000000005204581253033605802ID5923KEDAI MAMI BERKAH UMKM6007JAKARTA61051234062070703A01630489AB';

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
