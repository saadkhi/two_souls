import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, downloadCsv } from '@/components/admin/ui';
import { formatMoney } from '@/lib/format';

export default function AdminReports() {
  const [orders, setOrders] = useState([]);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    storeApi.entities.Order
      .filter(
        { created_date: { $gte: new Date(from).toISOString(), $lte: new Date(`${to}T23:59:59`).toISOString() } },
        { limit: 500 }
      )
      .then((page) => {
        setOrders(page.items || []);
        setLoading(false);
      });
  }, [from, to]);

  const live = orders.filter((o) => o.orderStatus !== 'cancelled');

  const productRows = useMemo(() => {
    const map = {};
    live.forEach((order) =>
      (order.items || []).forEach((item) => {
        const row = map[item.name] || { product: item.name, units: 0, revenue: 0, orders: 0 };
        row.units += Number(item.quantity || 0);
        row.revenue += Number(item.lineTotal || 0);
        row.orders += 1;
        map[item.name] = row;
      })
    );
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [live]);

  const paymentRows = useMemo(() => {
    const map = {};
    live.forEach((order) => {
      const row = map[order.paymentMethod] || { method: order.paymentMethod, orders: 0, revenue: 0, paid: 0 };
      row.orders += 1;
      row.revenue += Number(order.total || 0);
      if (order.paymentStatus === 'paid') row.paid += Number(order.total || 0);
      map[order.paymentMethod] = row;
    });
    return Object.values(map);
  }, [live]);

  const couponRows = useMemo(() => {
    const map = {};
    live.filter((o) => o.couponCode).forEach((order) => {
      const row = map[order.couponCode] || { code: order.couponCode, uses: 0, discount: 0, revenue: 0 };
      row.uses += 1;
      row.discount += Number(order.discount || 0);
      row.revenue += Number(order.total || 0);
      map[order.couponCode] = row;
    });
    return Object.values(map);
  }, [live]);

  const totals = {
    orders: live.length,
    revenue: live.reduce((s, o) => s + Number(o.total || 0), 0),
    paid: live.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + Number(o.total || 0), 0),
    units: productRows.reduce((s, r) => s + r.units, 0),
  };

  return (
    <div>
      <AdminHeading
        eyebrow="Analysis"
        title="Reports"
        action={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[10px] uppercase tracking-[0.14em]">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
            <label className="text-[10px] uppercase tracking-[0.14em]">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block border border-border bg-card px-2 py-1.5 text-xs" />
            </label>
          </div>
        }
      />

      {loading ? <p className="text-sm text-muted-foreground">Building report…</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ['Orders', totals.orders],
              ['Gross revenue', formatMoney(totals.revenue)],
              ['Verified paid', formatMoney(totals.paid)],
              ['Units sold', totals.units],
            ].map(([label, value]) => (
              <div key={label} className="border border-border bg-card p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-1 font-heading text-xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product report</p>
                <button type="button" onClick={() => downloadCsv('product-report.csv', productRows)} className="text-[10px] uppercase tracking-[0.16em] underline">CSV</button>
              </div>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr><th className="py-1">Fragrance</th><th className="py-1">Units</th><th className="py-1 text-right">Revenue</th></tr>
                </thead>
                <tbody>
                  {productRows.map((row) => (
                    <tr key={row.product} className="border-t border-border/60">
                      <td className="py-2">{row.product}</td>
                      <td className="py-2">{row.units}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                  {productRows.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">No sales in this period.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <div className="border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment report</p>
                <button type="button" onClick={() => downloadCsv('payment-report.csv', paymentRows)} className="text-[10px] uppercase tracking-[0.16em] underline">CSV</button>
              </div>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr><th className="py-1">Method</th><th className="py-1">Orders</th><th className="py-1 text-right">Verified</th><th className="py-1 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {paymentRows.map((row) => (
                    <tr key={row.method} className="border-t border-border/60">
                      <td className="py-2">{row.method}</td>
                      <td className="py-2">{row.orders}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(row.paid)}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                  {paymentRows.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No payments in this period.</td></tr> : null}
                </tbody>
              </table>
            </div>

            <div className="border border-border bg-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Coupon performance</p>
                <button type="button" onClick={() => downloadCsv('coupon-report.csv', couponRows)} className="text-[10px] uppercase tracking-[0.16em] underline">CSV</button>
              </div>
              <table className="mt-3 w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <tr><th className="py-1">Code</th><th className="py-1">Uses</th><th className="py-1 text-right">Discount given</th><th className="py-1 text-right">Revenue</th></tr>
                </thead>
                <tbody>
                  {couponRows.map((row) => (
                    <tr key={row.code} className="border-t border-border/60">
                      <td className="py-2">{row.code}</td>
                      <td className="py-2">{row.uses}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(row.discount)}</td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                  {couponRows.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No coupon usage in this period.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={() => downloadCsv(`orders-${from}-to-${to}.csv`, live.map((o) => ({
              orderNumber: o.orderNumber, date: o.created_date, customer: o.customerName, city: o.city,
              paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, orderStatus: o.orderStatus, total: o.total,
            })))}
            className="btn-luxe-ghost mt-6"
          >
            Export order report
          </button>
        </>
      )}
    </div>
  );
}