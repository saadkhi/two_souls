import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, StatCard, statusTone } from '@/components/admin/ui';
import { formatMoney, ORDER_STATUS_LABELS } from '@/lib/format';
import {
  CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

const COLORS = ['#C5A059', '#D4AF37', '#8A7F6B', '#6E6558', '#3A352D'];

function rangeFor(key) {
  const now = new Date();
  const start = new Date(now);
  if (key === 'today') start.setHours(0, 0, 0, 0);
  if (key === '7d') start.setDate(now.getDate() - 6);
  if (key === '30d') start.setDate(now.getDate() - 29);
  if (key === 'month') start.setDate(1), start.setHours(0, 0, 0, 0);
  if (key === 'lastMonth') {
    start.setMonth(now.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  return { from: start, to: now };
}

export default function Dashboard() {
  const [range, setRange] = useState('30d');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const { from, to } = rangeFor(range);
    Promise.all([
      storeApi.entities.Order.filter(
        { created_date: { $gte: from.toISOString(), $lte: to.toISOString() } },
        { sort: '-created_date', limit: 500 }
      ),
      storeApi.entities.Product.filter({}, { limit: 200 }),
      storeApi.entities.CustomerProfile.count(),
    ]).then(([orderPage, productPage, customerCount]) => {
      if (!alive) return;
      setOrders(orderPage.items || []);
      setProducts(productPage.items || []);
      setCustomers(customerCount);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [range]);

  const metrics = useMemo(() => {
    const live = orders.filter((o) => o.orderStatus !== 'cancelled');
    const totalSales = live.reduce((s, o) => s + Number(o.total || 0), 0);
    const paid = live.filter((o) => o.paymentStatus === 'paid');
    const netSales = paid.reduce((s, o) => s + Number(o.total || 0), 0);
    const pending = orders.filter((o) => ['confirmed', 'processing'].includes(o.orderStatus)).length;
    const codOrders = orders.filter((o) => o.paymentMethod === 'cod');
    const prepaid = orders.filter((o) => o.paymentMethod !== 'cod');
    const codOutstanding = codOrders
      .filter((o) => o.paymentStatus !== 'paid' && o.orderStatus !== 'cancelled')
      .reduce((s, o) => s + Number(o.total || 0), 0);
    const refunded = orders
      .filter((o) => o.paymentStatus === 'refunded')
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const byDay = {};
    live.forEach((order) => {
      const day = String(order.created_date || '').slice(0, 10);
      if (!day) return;
      byDay[day] = (byDay[day] || 0) + Number(order.total || 0);
    });
    const daily = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, value]) => ({ day: day.slice(5), sales: value }));

    const productTotals = {};
    live.forEach((order) => {
      (order.items || []).forEach((item) => {
        const entry = productTotals[item.name] || { name: item.name, quantity: 0, revenue: 0 };
        entry.quantity += Number(item.quantity || 0);
        entry.revenue += Number(item.lineTotal || 0);
        productTotals[item.name] = entry;
      });
    });
    const bestsellers = Object.values(productTotals).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    const paymentSplit = ['cod', 'bank_transfer', 'safepay', 'jazzcash', 'easypaisa']
      .map((method) => ({
        name: method === 'cod' ? 'Cash on delivery' : method === 'bank_transfer' ? 'Bank transfer' : method,
        value: orders.filter((o) => o.paymentMethod === method).length,
      }))
      .filter((row) => row.value > 0);

    const lowStock = products
      .flatMap((product) =>
        (product.variants || [])
          .filter((v) => Number(v.stock) <= Number(v.lowStockThreshold ?? 5))
          .map((v) => ({ product: product.name, size: v.size, stock: Number(v.stock), threshold: v.lowStockThreshold ?? 5 }))
      )
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);

    return {
      totalSales, netSales, pending, codCount: codOrders.length, prepaidCount: prepaid.length,
      codOutstanding, refunded, aov: live.length ? Math.round(totalSales / live.length) : 0,
      daily, bestsellers, paymentSplit, lowStock, orderCount: orders.length,
    };
  }, [orders, products]);

  return (
    <div>
      <AdminHeading
        eyebrow="Overview"
        title="Business dashboard"
        action={
          <div className="flex flex-wrap gap-2">
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key)}
                className={`border px-3 py-2 text-[10px] uppercase tracking-[0.16em] ${range === item.key ? 'border-accent bg-accent text-[#0F0E0D]' : 'border-border bg-card'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading figures…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total sales" value={formatMoney(metrics.totalSales)} hint={`${metrics.orderCount} orders in range`} />
            <StatCard label="Net sales (paid)" value={formatMoney(metrics.netSales)} hint="Verified payments only" />
            <StatCard label="Average order value" value={formatMoney(metrics.aov)} />
            <StatCard label="Pending orders" value={metrics.pending} hint="Awaiting confirmation or packing" />
            <StatCard label="COD orders" value={metrics.codCount} hint={`${metrics.prepaidCount} prepaid`} />
            <StatCard label="COD outstanding" value={formatMoney(metrics.codOutstanding)} tone="accent" hint="Uncollected cash" />
            <StatCard label="Customers" value={customers} hint="Profiles with an account" />
            <StatCard label="Refunds" value={formatMoney(metrics.refunded)} hint="Marked refunded" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="border border-border bg-card p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Daily sales</p>
              <div className="mt-4 h-64">
                {metrics.daily.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.daily}>
                      <CartesianGrid stroke="#D8CBB8" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="#85817A" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#85817A" width={60} />
                      <Tooltip formatter={(v) => formatMoney(v)} />
                      <Line type="monotone" dataKey="sales" stroke="#C5A059" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="pt-16 text-center text-sm text-muted-foreground">No orders in this range yet.</p>
                )}
              </div>
            </div>

            <div className="border border-border bg-card p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payment mix</p>
              <div className="mt-4 h-64">
                {metrics.paymentSplit.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={metrics.paymentSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                        {metrics.paymentSplit.map((entry, index) => (
                          <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="pt-16 text-center text-sm text-muted-foreground">No payments yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="border border-border bg-card p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bestselling fragrances</p>
              <ul className="mt-4 space-y-3 text-sm">
                {metrics.bestsellers.length ? metrics.bestsellers.map((item) => (
                  <li key={item.name} className="flex items-center justify-between gap-4 border-b border-border/60 pb-2">
                    <span>{item.name}</span>
                    <span className="text-muted-foreground">{item.quantity} sold · {formatMoney(item.revenue)}</span>
                  </li>
                )) : <li className="text-muted-foreground">No sales in this range.</li>}
              </ul>
            </div>

            <div className="border border-border bg-card p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Low stock</p>
              <ul className="mt-4 space-y-3 text-sm">
                {metrics.lowStock.length ? metrics.lowStock.map((row) => (
                  <li key={`${row.product}-${row.size}`} className="flex items-center justify-between gap-4 border-b border-border/60 pb-2">
                    <span>{row.product} · {row.size}</span>
                    <Pill tone={row.stock <= 0 ? 'red' : 'yellow'}>{row.stock} left</Pill>
                  </li>
                )) : <li className="text-muted-foreground">All sizes are above their threshold.</li>}
              </ul>
            </div>
          </div>

          <div className="mt-6 border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Recent orders</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <tr><th className="py-2">Order</th><th className="py-2">Customer</th><th className="py-2">City</th><th className="py-2">Payment</th><th className="py-2">Status</th><th className="py-2 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="border-t border-border/60">
                      <td className="py-2 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="py-2">{order.customerName}</td>
                      <td className="py-2">{order.city}</td>
                      <td className="py-2">
                        <Pill tone={statusTone(order.paymentStatus)}>{order.paymentStatus}</Pill>
                      </td>
                      <td className="py-2">
                        <Pill tone={statusTone(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</Pill>
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatMoney(order.total)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 ? (
                    <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No orders in this range.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}