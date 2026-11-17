import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, downloadCsv, statusTone } from '@/components/admin/ui';
import OrderDetail from '@/components/admin/OrderDetail';
import { formatDate, formatMoney, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/format';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [orderPage, courierRows, settingsRows] = await Promise.all([
      storeApi.entities.Order.filter({}, { sort: '-created_date', limit: 300 }),
      storeApi.entities.CourierAccount.filter({ active: true }),
      storeApi.entities.BusinessSettings.filter({ key: 'main' }),
    ]);
    setOrders(orderPage.items || []);
    setCouriers(courierRows);
    setSettings(settingsRows[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const haystack = `${order.orderNumber} ${order.customerName} ${order.customerPhone} ${order.city}`.toLowerCase();
        const matchSearch = !search || haystack.includes(search.toLowerCase());
        const matchStatus = !status || order.orderStatus === status;
        const matchMethod = !method || order.paymentMethod === method;
        return matchSearch && matchStatus && matchMethod;
      }),
    [orders, search, status, method]
  );

  const exportOrders = () => {
    downloadCsv(
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((order) => ({
        orderNumber: order.orderNumber,
        date: formatDate(order.created_date),
        customer: order.customerName,
        phone: order.customerPhone,
        city: order.city,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        courier: order.courier || '',
        tracking: order.trackingNumber || '',
        subtotal: order.subtotal,
        discount: order.discount,
        delivery: order.shippingFee,
        total: order.total,
      }))
    );
  };

  return (
    <div>
      <AdminHeading
        eyebrow="Fulfilment"
        title="Orders"
        action={
          <button type="button" onClick={exportOrders} className="btn-luxe-ghost">Export CSV</button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order, name, phone or city"
          className="min-h-[42px] w-full max-w-sm border border-border bg-card px-3 text-sm outline-none"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-[42px] border border-border bg-card px-3 text-xs">
          <option value="">All order statuses</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="min-h-[42px] border border-border bg-card px-3 text-xs">
          <option value="">All payment methods</option>
          <option value="cod">Cash on delivery</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="safepay">Safepay</option>
          <option value="jazzcash">JazzCash</option>
          <option value="easypaisa">Easypaisa</option>
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading orders…</p> : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs">{formatDate(order.created_date)}</td>
                  <td className="px-4 py-3 text-xs">
                    {order.customerName}<br />
                    <span className="text-muted-foreground">{order.customerPhone}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{order.city}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px]">{order.paymentMethod === 'cod' ? 'COD' : order.paymentMethod === 'bank_transfer' ? 'Bank' : order.paymentMethod}</span>
                      <Pill tone={statusTone(order.paymentStatus)}>{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</Pill>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Pill tone={statusTone(order.orderStatus)}>{ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}</Pill>
                      {order.trackingNumber ? <span className="text-[10px] text-muted-foreground">{order.courier} · {order.trackingNumber}</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(order.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setSelected(order)} className="text-[10px] uppercase tracking-[0.16em] underline">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No orders match this view.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <OrderDetail
          order={selected}
          open={!!selected}
          onOpenChange={(open) => !open && setSelected(null)}
          couriers={couriers}
          settings={settings}
          onUpdated={load}
        />
      ) : null}
    </div>
  );
}