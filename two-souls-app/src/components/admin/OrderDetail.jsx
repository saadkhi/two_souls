import { useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/format';
import { Pill, statusTone } from '@/components/admin/ui';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const STATUSES = Object.keys(ORDER_STATUS_LABELS);

function invoiceHtml(order, settings) {
  const rows = (order.items || [])
    .map((i) => `<tr><td>${i.name} · ${i.size}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${formatMoney(i.lineTotal)}</td></tr>`)
    .join('');
  return `<!doctype html><html><head><title>${order.orderNumber}</title>
  <style>body{font-family:Georgia,serif;color:#171717;padding:48px;max-width:760px;margin:auto}
  h1{font-size:26px;letter-spacing:.28em;font-weight:400}
  table{width:100%;border-collapse:collapse;margin-top:24px;font-size:13px}
  td,th{padding:8px 0;border-bottom:1px solid #D8CBB8}
  .muted{color:#85817A;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
  .totals{margin-top:16px;font-size:13px}.totals div{display:flex;justify-content:space-between;padding:4px 0}
  .total{border-top:1px solid #171717;margin-top:8px;padding-top:8px;font-size:16px}</style></head>
  <body>
  <h1>${settings?.wordmark || settings?.brandName || 'TWO SOULS'}</h1>
  <p class="muted">Invoice ${order.invoiceNumber || order.orderNumber}</p>
  <p class="muted">${order.customerName} · ${order.customerPhone}<br/>
  ${[order.house, order.street, order.area, order.city, order.province].filter(Boolean).join(', ')}</p>
  <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatMoney(order.subtotal)}</span></div>
    ${Number(order.discount) ? `<div><span>Discount</span><span>− ${formatMoney(order.discount)}</span></div>` : ''}
    <div><span>Delivery</span><span>${formatMoney(order.shippingFee)}</span></div>
    ${Number(order.codFee) ? `<div><span>COD handling</span><span>${formatMoney(order.codFee)}</span></div>` : ''}
    ${Number(order.taxAmount) ? `<div><span>Tax</span><span>${formatMoney(order.taxAmount)}</span></div>` : ''}
    <div class="total"><span>Total payable</span><span>${formatMoney(order.total)}</span></div>
  </div>
  <p class="muted" style="margin-top:32px">Payment: ${order.paymentMethod} · ${order.paymentStatus}<br/>
  ${settings?.legalName || ''} · ${settings?.address || ''}</p>
  </body></html>`;
}

export default function OrderDetail({ order, open, onOpenChange, couriers, settings, onUpdated }) {
  const [form, setForm] = useState({ orderStatus: 'confirmed', paymentStatus: 'unpaid', courier: '', trackingNumber: '', internalNotes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setForm({
        orderStatus: order.orderStatus || 'confirmed',
        paymentStatus: order.paymentStatus || 'unpaid',
        courier: order.courier || '',
        trackingNumber: order.trackingNumber || '',
        internalNotes: order.internalNotes || '',
      });
    }
  }, [order]);

  if (!order) return null;

  const save = async () => {
    setSaving(true);
    const history = [...(order.statusHistory || [])];
    if (form.orderStatus !== order.orderStatus) {
      history.push({ status: form.orderStatus, note: 'Updated by owner', at: new Date().toISOString() });
    }
    await storeApi.entities.Order.update(order.id, {
      ...form,
      statusHistory: history,
      codAmount: order.paymentMethod === 'cod' ? order.total : order.codAmount,
    });
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const markPaid = async () => {
    setSaving(true);
    await storeApi.entities.Order.update(order.id, { paymentStatus: 'paid', orderStatus: order.orderStatus === 'confirmed' ? 'processing' : order.orderStatus });
    const payments = await storeApi.entities.Payment.filter({ orderNumber: order.orderNumber });
    const me = await storeApi.auth.me();
    if (payments.length) {
      await storeApi.entities.Payment.update(payments[0].id, {
        status: 'success',
        verifiedBy: me.email,
        verifiedAt: new Date().toISOString(),
      });
    } else {
      await storeApi.entities.Payment.create({
        orderId: order.id,
        orderNumber: order.orderNumber,
        method: order.paymentMethod,
        amount: order.total,
        status: 'success',
        verifiedBy: me.email,
        verifiedAt: new Date().toISOString(),
      });
    }
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const cancel = async () => {
    setSaving(true);
    for (const item of order.items || []) {
      const product = await storeApi.entities.Product.get(item.productId).catch(() => null);
      if (!product) continue;
      const variants = (product.variants || []).map((v) =>
        v.sku === item.sku ? { ...v, stock: (Number(v.stock) || 0) + Number(item.quantity) } : v
      );
      await storeApi.entities.Product.update(product.id, { variants });
      await storeApi.entities.InventoryLog.create({
        productId: product.id,
        productName: product.name,
        variantSku: item.sku,
        variantSize: item.size,
        type: 'cancellation',
        quantityChange: Number(item.quantity),
        balanceAfter: variants.find((v) => v.sku === item.sku)?.stock || 0,
        reason: 'Order cancelled',
        reference: order.orderNumber,
      });
    }
    await storeApi.entities.Order.update(order.id, {
      orderStatus: 'cancelled',
      stockReleased: true,
      statusHistory: [...(order.statusHistory || []), { status: 'cancelled', note: 'Cancelled by owner', at: new Date().toISOString() }],
    });
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const print = () => {
    const win = window.open('', '_blank', 'width=820,height=900');
    if (!win) return;
    win.document.write(invoiceHtml(order, settings));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-border bg-card p-0">
        <DialogTitle className="sr-only">Order {order.orderNumber}</DialogTitle>
        <div className="sticky top-0 z-10 border-b border-border bg-card px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-heading text-2xl">{order.orderNumber}</h2>
              <p className="text-[11px] text-muted-foreground">{formatDateTime(order.created_date)}</p>
            </div>
            <div className="flex gap-2">
              <Pill tone={statusTone(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</Pill>
              <Pill tone={statusTone(order.paymentStatus)}>{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</Pill>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm">
          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Customer</p>
              <p className="mt-1">{order.customerName}</p>
              <p>{order.customerPhone}</p>
              {order.whatsapp ? <p className="text-muted-foreground">WhatsApp {order.whatsapp}</p> : null}
              {order.customerEmail ? <p className="text-muted-foreground">{order.customerEmail}</p> : null}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Delivery address</p>
              <p className="mt-1">{[order.house, order.street].filter(Boolean).join(', ')}</p>
              <p>{[order.area, order.district, order.city, order.province].filter(Boolean).join(', ')}</p>
              {order.landmark ? <p className="text-muted-foreground">Near {order.landmark}</p> : null}
              {order.deliveryInstructions ? <p className="text-muted-foreground">{order.deliveryInstructions}</p> : null}
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Items</p>
            <ul className="mt-2 space-y-2">
              {(order.items || []).map((item) => (
                <li key={`${item.sku}-${item.size}`} className="flex justify-between border-b border-border/60 pb-2">
                  <span>{item.name} · {item.size} × {item.quantity}</span>
                  <span className="tabular-nums">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
              {Number(order.discount) ? <div className="flex justify-between"><span className="text-muted-foreground">Discount {order.couponCode ? `(${order.couponCode})` : ''}</span><span>− {formatMoney(order.discount)}</span></div> : null}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span>{formatMoney(order.shippingFee)}</span></div>
              {Number(order.codFee) ? <div className="flex justify-between"><span className="text-muted-foreground">COD handling</span><span>{formatMoney(order.codFee)}</span></div> : null}
              {Number(order.taxAmount) ? <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoney(order.taxAmount)}</span></div> : null}
              <div className="flex justify-between border-t border-border pt-2 font-heading text-base"><span>Total</span><span>{formatMoney(order.total)}</span></div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Payment method: {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod === 'bank_transfer' ? 'Bank transfer' : order.paymentMethod}
              {order.receiptUri ? ' · receipt uploaded' : ''}
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label-luxe">Order status</span>
              <select value={form.orderStatus} onChange={(e) => setForm((f) => ({ ...f, orderStatus: e.target.value }))} className="field-luxe">
                {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-luxe">Courier</span>
              <select value={form.courier} onChange={(e) => setForm((f) => ({ ...f, courier: e.target.value }))} className="field-luxe">
                <option value="">Not booked</option>
                {couriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label-luxe">Tracking / waybill number</span>
              <input value={form.trackingNumber} onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))} className="field-luxe" />
            </label>
            <label className="block">
              <span className="label-luxe">Payment status</span>
              <select value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))} className="field-luxe">
                {Object.entries(PAYMENT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="label-luxe">Internal notes (not visible to the customer)</span>
                <textarea rows={2} value={form.internalNotes} onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))} className="field-luxe" />
              </label>
            </div>
          </section>

          {(order.statusHistory || []).length ? (
            <section>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">History</p>
              <ol className="mt-2 space-y-1 text-xs">
                {order.statusHistory.map((entry, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span>{ORDER_STATUS_LABELS[entry.status] || entry.status}{entry.note ? ` — ${entry.note}` : ''}</span>
                    <span className="text-muted-foreground">{formatDateTime(entry.at)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.16em]">
            <button type="button" onClick={print} className="underline">Print invoice</button>
            {order.paymentStatus !== 'paid' ? (
              <button type="button" onClick={markPaid} disabled={saving} className="underline">Mark payment verified</button>
            ) : null}
            {!['cancelled', 'delivered'].includes(order.orderStatus) ? (
              <button type="button" onClick={cancel} disabled={saving} className="underline text-destructive">Cancel order</button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="btn-luxe-ghost">Close</button>
            <button type="button" onClick={save} disabled={saving} className="btn-luxe">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}