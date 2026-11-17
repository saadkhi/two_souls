import { useState } from 'react';
import { Search } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDateTime, formatMoney } from '@/lib/format';

export default function TrackOrder() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await storeApi.functions.invoke('trackOrder', { orderNumber, phone });
      if (res.data?.error) setError(res.data.error);
      else setOrder(res.data.order);
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not find that order.');
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-14 lg:py-20">
      <p className="eyebrow">Order tracking</p>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Where is my order?</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Enter the order number from your confirmation and the mobile number used at checkout.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="orderNumber" className="label-luxe">Order number</label>
          <input id="orderNumber" required value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="AN-261111-1234" className="field-luxe" />
        </div>
        <div>
          <label htmlFor="phone" className="label-luxe">Mobile number</label>
          <input id="phone" required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" className="field-luxe" />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={loading} className="btn-luxe w-full sm:w-auto">
            <Search className="h-3.5 w-3.5" />
            {loading ? 'Looking up…' : 'Track order'}
          </button>
        </div>
      </form>

      {error ? <p className="mt-6 border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : null}

      {order ? (
        <div className="mt-10 border border-border bg-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-4">
            <p className="font-heading text-2xl">{order.orderNumber}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
            </p>
          </div>
          <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Placed</dt>
              <dd className="mt-1">{formatDateTime(order.placedAt)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment</dt>
              <dd className="mt-1">{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Courier</dt>
              <dd className="mt-1">{order.courier || 'Not booked yet'}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tracking number</dt>
              <dd className="mt-1">{order.trackingNumber || 'Available once dispatched'}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Items</p>
            <ul className="mt-2 space-y-1 text-sm">
              {order.items.map((item) => (
                <li key={`${item.name}-${item.size}`}>{item.name} · {item.size} × {item.quantity}</li>
              ))}
            </ul>
            <p className="mt-4 flex justify-between border-t border-border pt-3 text-sm">
              <span>Total</span><span>{formatMoney(order.total)}</span>
            </p>
          </div>

          {(order.statusHistory || []).length ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
              <ol className="mt-3 space-y-2 text-xs">
                {order.statusHistory.map((entry, index) => (
                  <li key={index} className="flex justify-between gap-4">
                    <span>{ORDER_STATUS_LABELS[entry.status] || entry.status}{entry.note ? ` — ${entry.note}` : ''}</span>
                    <span className="text-muted-foreground">{formatDateTime(entry.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
