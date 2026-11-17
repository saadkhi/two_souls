import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, downloadCsv, statusTone } from '@/components/admin/ui';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [paymentRows, orderPage, settingsRows] = await Promise.all([
      storeApi.entities.Payment.filter({}, { sort: '-created_date', limit: 300 }),
      storeApi.entities.Order.filter({}, { sort: '-created_date', limit: 500 }),
      storeApi.entities.BusinessSettings.filter({ key: 'main' }),
    ]);
    setPayments(paymentRows.items || []);
    setOrders(orderPage.items || []);
    setSettings(settingsRows[0] || null);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const byMethod = {};
    payments.forEach((p) => {
      byMethod[p.method] = byMethod[p.method] || { pending: 0, success: 0, failed: 0, count: 0 };
      byMethod[p.method].count += 1;
      if (p.status === 'success') byMethod[p.method].success += Number(p.amount || 0);
      else if (p.status === 'failed') byMethod[p.method].failed += Number(p.amount || 0);
      else byMethod[p.method].pending += Number(p.amount || 0);
    });
    return byMethod;
  }, [payments]);

  const verify = async (payment) => {
    setSaving(true);
    const me = await storeApi.auth.me();
    await storeApi.entities.Payment.update(payment.id, {
      status: 'success',
      verifiedBy: me.email,
      verifiedAt: new Date().toISOString(),
    });
    const order = orders.find((o) => o.orderNumber === payment.orderNumber);
    if (order) await storeApi.entities.Order.update(order.id, { paymentStatus: 'paid' });
    setSaving(false);
    load();
  };

  const label = { cod: 'Cash on delivery', bank_transfer: 'Bank transfer', safepay: 'Safepay', jazzcash: 'JazzCash', easypaisa: 'Easypaisa' };
  const methods = settings?.paymentMethods || {};

  return (
    <div>
      <AdminHeading
        eyebrow="Money"
        title="Payments"
        action={<button type="button" onClick={() => downloadCsv('payments.csv', payments.map((p) => ({ order: p.orderNumber, method: p.method, amount: p.amount, status: p.status, date: formatDate(p.created_date), reference: p.reference || '', verifiedBy: p.verifiedBy || '' })))} className="btn-luxe-ghost">Export CSV</button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(label).map(([key, name]) => {
          const row = summary[key] || { pending: 0, success: 0, count: 0 };
          const enabled = key === 'cod' ? methods?.cod?.enabled !== false : methods?.[key]?.enabled === true;
          return (
            <div key={key} className="border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{name}</p>
                <Pill tone={enabled ? 'green' : 'gray'}>{enabled ? 'Active' : 'Off'}</Pill>
              </div>
              <p className="mt-2 font-heading text-xl">{formatMoney(row.success)}</p>
              <p className="text-[11px] text-muted-foreground">{row.count} transactions · {formatMoney(row.pending)} pending</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 overflow-x-auto border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Recorded</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-border">
                <td className="px-4 py-3">{payment.orderNumber}</td>
                <td className="px-4 py-3 text-xs">{label[payment.method] || payment.method}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{formatMoney(payment.amount)}</td>
                <td className="px-4 py-3"><Pill tone={statusTone(payment.status)}>{payment.status}</Pill></td>
                <td className="px-4 py-3 text-xs">{formatDateTime(payment.created_date)}</td>
                <td className="px-4 py-3 text-xs">{payment.verifiedBy ? `${payment.verifiedBy}` : payment.receiptUri ? 'Receipt uploaded' : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {payment.status !== 'success' ? (
                    <button type="button" onClick={() => verify(payment)} disabled={saving} className="text-[10px] uppercase tracking-[0.16em] underline">
                      Verify payment
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {payments.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No transactions recorded yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="mt-6 border border-border bg-card p-5 text-xs leading-relaxed text-muted-foreground">
        <p className="text-[10px] uppercase tracking-[0.2em] text-foreground">Gateway status</p>
        <ul className="mt-2 space-y-1">
          <li>Safepay — {(methods.safepay?.configured ? 'credentials on file' : 'awaiting merchant credentials')}. Not accepting payments until server-side verification is tested.</li>
          <li>JazzCash — {(methods.jazzcash?.configured ? 'credentials on file' : 'awaiting merchant credentials')}. Not accepting payments yet.</li>
          <li>Easypaisa — {(methods.easypaisa?.configured ? 'credentials on file' : 'awaiting merchant credentials')}. Not accepting payments yet.</li>
        </ul>
        <p className="mt-2">A browser redirect is never treated as proof of payment; every gateway transaction is only marked paid after server verification.</p>
      </div>
    </div>
  );
}