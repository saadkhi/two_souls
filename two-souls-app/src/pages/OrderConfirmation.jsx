import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatMoney, formatDate } from '@/lib/format';

export default function OrderConfirmation() {
  const [order, setOrder] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('an_last_order');
      if (raw) setOrder(JSON.parse(raw));
    } catch (error) {
      setOrder(null);
    }
  }, []);

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-5 py-28 text-center">
        <h1 className="font-heading text-4xl">No recent order to show</h1>
        <p className="mt-3 text-sm text-muted-foreground">You can look up an existing order with your order number and phone.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/track" className="btn-luxe">Track an order</Link>
          <Link to="/shop" className="btn-luxe-ghost">Continue shopping</Link>
        </div>
      </div>
    );
  }

  const symbol = 'Rs.';

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 lg:py-24">
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent" strokeWidth={1} />
        <p className="eyebrow mt-6">Order confirmed</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Thank you, {order.customerName.split(' ')[0]}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your order number is <span className="text-foreground">{order.orderNumber}</span>. We will confirm your order by phone.
        </p>
      </div>

      <div className="mt-10 border border-border bg-card p-6">
        <div className="grid gap-4 border-b border-border pb-5 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Order status</p>
            <p className="mt-1">{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment</p>
            <p className="mt-1">
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod === 'bank_transfer' ? 'Bank transfer' : order.paymentMethod}
              {' · '}
              {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Delivering to</p>
            <p className="mt-1">{order.city}, {order.province}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Placed</p>
            <p className="mt-1">{formatDate(order.created_date || new Date())}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {order.items.map((item) => (
            <div key={`${item.sku}-${item.size}`} className="flex justify-between text-sm">
              <span>{item.name} · {item.size} × {item.quantity}</span>
              <span>{formatMoney(item.lineTotal, symbol)}</span>
            </div>
          ))}
        </div>

        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(order.subtotal, symbol)}</dd></div>
          {Number(order.discount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {formatMoney(order.discount, symbol)}</dd></div> : null}
          <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{Number(order.shippingFee) === 0 ? 'Complimentary' : formatMoney(order.shippingFee, symbol)}</dd></div>
          {Number(order.codFee) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">COD handling</dt><dd>{formatMoney(order.codFee, symbol)}</dd></div> : null}
          {Number(order.taxAmount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(order.taxAmount, symbol)}</dd></div> : null}
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <dt className="text-[10px] uppercase tracking-[0.22em]">Total payable</dt>
            <dd className="font-heading text-2xl">{formatMoney(order.total, symbol)}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/track" className="btn-luxe">Track this order</Link>
        <Link to="/shop" className="btn-luxe-ghost">Continue shopping</Link>
      </div>
      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        {order.paymentMethod === 'bank_transfer'
          ? 'Your order will be marked paid once we verify your transfer.'
          : 'Please keep the exact amount ready for the rider.'}
      </p>
    </div>
  );
}