export function formatMoney(value, symbol = 'Rs.') {
  const n = Number(value || 0);
  return `${symbol} ${n.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
    ...opts,
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDate(d)} · ${d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
  })}`;
}

export function priceOf(variant) {
  if (!variant) return { price: 0, compareAt: null, onSale: false };
  const price = Number(variant.salePrice || variant.price || 0);
  const compareAt = variant.salePrice ? Number(variant.price || 0) : null;
  return { price, compareAt, onSale: !!variant.salePrice && Number(variant.salePrice) < Number(variant.price) };
}

export function productFromPrice(product) {
  const prices = (product?.variants || []).map((v) => Number(v.salePrice || v.price || 0)).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : 0;
}

export function productStock(product) {
  return (product?.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
}

export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const PROVINCES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Azad Jammu and Kashmir',
  'Gilgit-Baltistan',
];

export function normalizePkPhone(input) {
  const digits = String(input || '').replace(/[^\d+]/g, '');
  if (/^\+92\d{10}$/.test(digits)) return digits;
  if (/^0092\d{10}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^92\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export const ORDER_STATUS_LABELS = {
  confirmed: 'Order Confirmed',
  processing: 'Processing',
  packed: 'Packed',
  courier_booked: 'Courier Booked',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  returned: 'Returned to Origin',
  cancelled: 'Cancelled',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Unpaid',
  awaiting_verification: 'Awaiting Verification',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
};