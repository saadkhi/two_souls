import { randomInt } from 'node:crypto';
import { withTransaction } from './db.js';
import { createEntityStore } from './entities.js';
import { HttpError } from './http.js';

const PAYMENT_METHODS = new Set(['cod', 'bank_transfer', 'safepay', 'jazzcash', 'easypaisa']);
const INACTIVE_GATEWAYS = new Set(['safepay', 'jazzcash', 'easypaisa']);
const round = value => Math.round(Number(value) || 0);

export class ActionError extends HttpError {}

const fail = (status, message, details) => { throw new ActionError(status, message, details); };
const text = value => String(value ?? '').trim();
const systemActor = user => ({
  id: user?.id || null,
  email: text(user?.email).toLowerCase(),
  role: 'system',
});

function calculateDiscount(coupon, eligible) {
  return coupon.type === 'percentage'
    ? Math.min(eligible, Math.round((eligible * Number(coupon.value || 0)) / 100))
    : Math.min(eligible, Number(coupon.value || 0));
}

function validateCouponRecord(coupon, subtotal, now = Date.now()) {
  if (!coupon || coupon.active !== true) fail(400, 'This offer code is not valid.');
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    fail(400, 'This offer code is not active yet.');
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    fail(400, 'This offer code has expired.');
  }
  if (Number(coupon.usageLimit) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) {
    fail(400, 'This offer code has reached its limit.');
  }
  if (subtotal < Number(coupon.minOrderAmount || 0)) {
    fail(400, `This code needs an order of at least Rs. ${Number(coupon.minOrderAmount).toLocaleString('en-PK')}.`);
  }
}

function lineEligibility(lines, productsById, coupon) {
  if (coupon.scope === 'product') {
    return lines.filter(line => line.productId === coupon.scopeValue)
      .reduce((sum, line) => sum + line.lineTotal, 0);
  }
  if (coupon.scope === 'collection') {
    return lines.filter(line => productsById.get(line.productId)?.collection === coupon.scopeValue)
      .reduce((sum, line) => sum + line.lineTotal, 0);
  }
  return lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

function priceLines(items, products) {
  const productsById = new Map(products.map(product => [String(product.id), product]));
  const lines = [];
  const stockByVariant = new Map();

  for (const raw of items) {
    const product = productsById.get(String(raw.productId || ''));
    if (!product || product.status !== 'active') fail(409, 'One of the fragrances is no longer available.');
    if (product.complianceStatus && product.complianceStatus !== 'approved') {
      fail(409, `"${product.name}" is not available for sale yet.`);
    }
    const variant = (product.variants || []).find(item => item.sku === String(raw.sku || ''));
    if (!variant || variant.active === false) fail(409, 'A selected size is no longer available.');
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(raw.quantity) || 1)));
    const key = `${product.id}\u0000${variant.sku}`;
    const reserved = (stockByVariant.get(key)?.quantity || 0) + quantity;
    const available = Number(variant.stock) || 0;
    if (available < reserved) fail(409, `Only ${available} left of ${product.name} ${variant.size}.`);
    stockByVariant.set(key, { product, variant, quantity: reserved });
    const unitPrice = Number(variant.salePrice || variant.price || 0);
    lines.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      size: variant.size,
      sku: variant.sku,
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
      image: (product.images || [])[0] || '',
    });
  }

  return { lines, productsById, stockPlan: [...stockByVariant.values()] };
}

async function validateCoupon(body, store) {
  const code = text(body.code).toUpperCase();
  const items = Array.isArray(body.items) ? body.items : [];
  if (!code) fail(400, 'Enter an offer code.');
  if (!items.length) fail(400, 'Your bag is empty.');

  const ids = [...new Set(items.map(item => text(item.productId)).filter(Boolean))];
  const products = ids.length ? await store.query('Product', { id: { $in: ids } }) : [];
  const productsById = new Map(products.map(product => [String(product.id), product]));
  const lines = [];
  for (const item of items) {
    const product = productsById.get(String(item.productId || ''));
    const variant = (product?.variants || []).find(candidate => candidate.sku === String(item.sku || ''));
    if (!product || !variant) continue;
    const quantity = Math.max(1, Math.min(20, Math.floor(Number(item.quantity) || 1)));
    const unitPrice = Number(variant.salePrice || variant.price || 0);
    lines.push({ productId: product.id, quantity, lineTotal: unitPrice * quantity });
  }
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const coupon = (await store.query('Coupon', { code, active: true }, { limit: 1 }))[0];
  validateCouponRecord(coupon, subtotal);
  const eligible = lineEligibility(lines, productsById, coupon);
  if (eligible <= 0) fail(400, 'This code does not apply to the items in your bag.');
  return { coupon: { code: coupon.code, discount: calculateDiscount(coupon, eligible), description: coupon.description || '' } };
}

async function trackOrder(body, store) {
  const orderNumber = text(body.orderNumber).toUpperCase();
  const phone = String(body.phone || '').replace(/[^\d]/g, '').slice(-10);
  if (!orderNumber || phone.length < 10) fail(400, 'Enter your order number and mobile number.');
  const orders = await store.query('Order', { orderNumber }, { limit: 5 });
  const order = orders.find(candidate =>
    String(candidate.customerPhone || '').replace(/[^\d]/g, '').slice(-10) === phone);
  if (!order) fail(404, 'No order found for those details.');
  return {
    order: {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      city: order.city,
      placedAt: order.created_date,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      courier: order.courier || '',
      trackingNumber: order.trackingNumber || '',
      items: (order.items || []).map(item => ({ name: item.name, size: item.size, quantity: item.quantity })),
      total: order.total,
      statusHistory: order.statusHistory || [],
    },
  };
}

function shippingQuote(body, settings, zones, subtotal, discount, method) {
  const city = text(body.city);
  const province = text(body.province);
  const zone = zones.find(candidate =>
    (candidate.cities || []).some(value => String(value).toLowerCase() === city.toLowerCase()) ||
    (candidate.provinces || []).some(value => String(value).toLowerCase() === province.toLowerCase()));
  if (zone?.zoneType === 'restricted') fail(400, 'We do not deliver to this location yet.');
  if (method === 'cod' && zone?.codAvailable === false) {
    fail(400, 'Cash on delivery is not available for this city.');
  }

  const threshold = Number(settings.freeShippingThreshold || 0);
  const freeShipping = threshold > 0 && subtotal - discount >= threshold;
  const baseFee = Number(zone?.fee ?? settings.standardShippingFee ?? 0);
  const express = body.shippingMethod === 'express';
  let shippingFee = freeShipping && !express ? 0 : baseFee;
  if (express) {
    shippingFee = Number(zone?.expressFee ?? settings.expressShippingFee ?? (freeShipping ? 0 : baseFee));
  }
  const paymentConfig = settings.paymentMethods || {};
  const codFee = method === 'cod'
    ? Number(paymentConfig?.cod?.fee ?? zone?.codFee ?? settings.codFee ?? 0)
    : 0;
  const taxable = subtotal - discount;
  const taxRate = Number(settings.defaultTaxRate || 0);
  const taxAmount = settings.taxEnabled && !settings.taxInclusive && taxRate > 0
    ? round((taxable * taxRate) / 100)
    : 0;
  return { city, province, shippingFee, codFee, taxAmount, total: round(taxable + shippingFee + codFee + taxAmount) };
}

function assertPaymentMethod(method, settings) {
  if (!PAYMENT_METHODS.has(method)) fail(400, 'Unknown payment method.');
  if (INACTIVE_GATEWAYS.has(method)) {
    fail(400, 'This payment method is not active yet. Please choose cash on delivery or bank transfer.');
  }
  const payment = settings.paymentMethods || {};
  if (method === 'cod' && payment?.cod?.enabled === false) {
    fail(400, 'Cash on delivery is currently unavailable.');
  }
  if (method === 'bank_transfer' && payment?.bank?.enabled !== true) {
    fail(400, 'Bank transfer is currently unavailable.');
  }
}

function makeOrderNumber(settings, now) {
  const prefix = text(settings.invoicePrefix) || 'AN';
  const date = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}-${date}-${randomInt(100000, 1000000)}`;
}

async function placeOrderInTransaction(body, user, store) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) fail(400, 'Your bag is empty.');
  if (items.length > 25) fail(400, 'Too many items in one order.');
  const idempotencyKey = String(body.idempotencyKey || '').slice(0, 80);
  if (idempotencyKey) {
    const existing = await store.query('Order', { idempotencyKey }, { limit: 1, lock: 'update' });
    if (existing.length) return { order: existing[0], duplicate: true };
  }

  const settings = (await store.query('BusinessSettings', {}, { limit: 1 }))[0] || {};
  const method = String(body.paymentMethod || 'cod');
  assertPaymentMethod(method, settings);
  const ids = [...new Set(items.map(item => text(item.productId)).filter(Boolean))];
  if (!ids.length) fail(400, 'Your bag is empty.');
  const products = await store.query('Product', { id: { $in: ids } }, { lock: 'update' });
  const { lines, productsById, stockPlan } = priceLines(items, products);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  let discount = 0;
  let coupon = null;
  const code = text(body.couponCode).toUpperCase();
  if (code) {
    coupon = (await store.query('Coupon', { code, active: true }, { limit: 1, lock: 'update' }))[0];
    validateCouponRecord(coupon, subtotal);
    const eligible = lineEligibility(lines, productsById, coupon);
    if (eligible <= 0) fail(400, 'This code does not apply to the items in your bag.');
    discount = calculateDiscount(coupon, eligible);
  }

  for (const field of ['customerName', 'customerPhone', 'city', 'street']) {
    if (!text(body[field])) fail(400, `Missing required field: ${field}`);
  }
  const zones = await store.query('ShippingZone', { active: true });
  const quote = shippingQuote(body, settings, zones, subtotal, discount, method);

  for (const plan of stockPlan) {
    const variants = (plan.product.variants || []).map(variant => variant.sku === plan.variant.sku
      ? { ...variant, stock: (Number(variant.stock) || 0) - plan.quantity }
      : variant);
    await store.update('Product', plan.product.id, { variants });
  }

  const now = new Date();
  const orderNumber = makeOrderNumber(settings, now);
  const actor = systemActor(user);
  const receiptUri = method === 'bank_transfer' ? text(body.receiptUri) : '';
  const order = await store.create('Order', {
    orderNumber,
    invoiceNumber: orderNumber,
    idempotencyKey: idempotencyKey || undefined,
    userEmail: actor.email,
    customerName: text(body.customerName),
    customerEmail: text(body.customerEmail).toLowerCase(),
    customerPhone: text(body.customerPhone),
    whatsapp: text(body.whatsapp),
    province: quote.province,
    city: quote.city,
    district: text(body.district),
    area: text(body.area),
    street: text(body.street),
    house: text(body.house),
    landmark: text(body.landmark),
    postalCode: text(body.postalCode),
    deliveryInstructions: text(body.deliveryInstructions),
    items: lines,
    subtotal,
    discount,
    couponCode: code,
    shippingFee: quote.shippingFee,
    shippingCharges: quote.shippingFee,
    codFee: quote.codFee,
    codAmount: method === 'cod' ? quote.total : 0,
    taxAmount: quote.taxAmount,
    total: quote.total,
    paymentMethod: method,
    paymentStatus: method === 'bank_transfer' && receiptUri ? 'awaiting_verification' : 'unpaid',
    orderStatus: 'confirmed',
    receiptUri,
    customerNote: text(body.customerNote),
    statusHistory: [{ status: 'confirmed', note: 'Order placed', at: now.toISOString() }],
  }, actor);

  await store.create('Payment', {
    orderId: order.id,
    orderNumber,
    method,
    amount: quote.total,
    status: method === 'bank_transfer' ? 'awaiting_verification' : 'pending',
    receiptUri,
    notes: method === 'cod' ? 'Cash to be collected on delivery' : '',
  }, actor);

  await store.bulkCreate('InventoryLog', stockPlan.map(plan => ({
    productId: plan.product.id,
    productName: plan.product.name,
    variantSku: plan.variant.sku,
    variantSize: plan.variant.size,
    type: 'sale',
    quantityChange: -plan.quantity,
    balanceAfter: (Number(plan.variant.stock) || 0) - plan.quantity,
    reason: 'Order placed',
    reference: orderNumber,
    actor: actor.email || 'storefront',
  })), actor);

  if (coupon) {
    await store.update('Coupon', coupon.id, { usedCount: Number(coupon.usedCount || 0) + 1 });
  }
  if (actor.email) {
    const profile = (await store.query('CustomerProfile', { userEmail: actor.email }, { limit: 1, lock: 'update' }))[0];
    const profileData = {
      userEmail: actor.email,
      fullName: text(body.customerName),
      phone: text(body.customerPhone),
      city: quote.city,
      province: quote.province,
      totalOrders: Number(profile?.totalOrders || 0) + 1,
      totalSpending: Number(profile?.totalSpending || 0) + quote.total,
      lastOrderDate: now.toISOString(),
    };
    if (profile) await store.update('CustomerProfile', profile.id, profileData);
    else await store.create('CustomerProfile', profileData, actor);
  }
  return { order };
}

async function placeOrder(body, user) {
  return withTransaction(async client => {
    const store = createEntityStore({ client, privileged: true });
    return placeOrderInTransaction(body, user, store);
  });
}

const actions = { validateCoupon, trackOrder, placeOrder };

export async function invokeAction(name, body = {}, user = null) {
  const action = actions[name];
  if (!action) fail(404, 'Unknown action.');
  if (name === 'placeOrder') return action(body, user);
  return action(body, createEntityStore({ privileged: true }));
}

export const actionInternals = {
  calculateDiscount,
  lineEligibility,
  priceLines,
  shippingQuote,
  validateCouponRecord,
};
