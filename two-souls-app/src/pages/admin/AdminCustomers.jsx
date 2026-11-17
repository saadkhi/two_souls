import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, downloadCsv } from '@/components/admin/ui';
import { formatDate, formatMoney } from '@/lib/format';

export default function AdminCustomers() {
  const [profiles, setProfiles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState(null);

  const load = async () => {
    const [profilePage, orderPage] = await Promise.all([
      storeApi.entities.CustomerProfile.filter({}, { limit: 200 }),
      storeApi.entities.Order.filter({}, { sort: '-created_date', limit: 500 }),
    ]);
    setProfiles(profilePage.items || []);
    setOrders(orderPage.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const customers = useMemo(() => {
    const map = new Map();
    profiles.forEach((profile) => {
      map.set(profile.userEmail || profile.id, {
        key: profile.userEmail || profile.id,
        id: profile.id,
        name: profile.fullName,
        email: profile.userEmail,
        phone: profile.phone,
        city: profile.city,
        orders: Number(profile.totalOrders || 0),
        spending: Number(profile.totalSpending || 0),
        last: profile.lastOrderDate,
        notes: profile.notes || '',
      });
    });
    orders.forEach((order) => {
      const key = order.userEmail || order.customerPhone;
      if (!key) return;
      const existing = map.get(key) || {
        key, id: null, name: order.customerName, email: order.customerEmail || order.userEmail,
        phone: order.customerPhone, city: order.city, orders: 0, spending: 0, last: null, notes: '',
      };
      existing.orders += 1;
      if (order.paymentStatus === 'paid' || order.orderStatus === 'delivered') existing.spending += Number(order.total || 0);
      if (!existing.last || new Date(order.created_date) > new Date(existing.last)) existing.last = order.created_date;
      if (!existing.name) existing.name = order.customerName;
      map.set(key, existing);
    });
    return [...map.values()].sort((a, b) => b.spending - a.spending);
  }, [profiles, orders]);

  const filtered = customers.filter((c) =>
    !search || `${c.name} ${c.email} ${c.phone} ${c.city}`.toLowerCase().includes(search.toLowerCase())
  );

  const saveNote = async () => {
    if (!note) return;
    if (note.id) {
      await storeApi.entities.CustomerProfile.update(note.id, { notes: note.notes });
    } else {
      await storeApi.entities.CustomerProfile.create({
        userEmail: note.email,
        fullName: note.name,
        phone: note.phone,
        city: note.city,
        notes: note.notes,
      });
    }
    setNote(null);
    load();
  };

  return (
    <div>
      <AdminHeading
        eyebrow="Clients"
        title="Customers"
        action={<button type="button" onClick={() => downloadCsv('customers.csv', filtered.map(({ key, ...rest }) => rest))} className="btn-luxe-ghost">Export CSV</button>}
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, phone or city"
        className="mb-4 min-h-[42px] w-full max-w-sm border border-border bg-card px-3 text-sm outline-none"
      />

      <div className="overflow-x-auto border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Spending</th>
              <th className="px-4 py-3">Last purchase</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((customer) => (
              <tr key={customer.key} className="border-t border-border">
                <td className="px-4 py-3 font-heading text-base">{customer.name || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {customer.phone}<br /><span className="text-muted-foreground">{customer.email || 'guest'}</span>
                </td>
                <td className="px-4 py-3 text-xs">{customer.city || '—'}</td>
                <td className="px-4 py-3 text-xs">{customer.orders}</td>
                <td className="px-4 py-3 text-xs tabular-nums">{formatMoney(customer.spending)}</td>
                <td className="px-4 py-3 text-xs">{customer.last ? formatDate(customer.last) : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setNote(customer)} className="text-[10px] uppercase tracking-[0.16em] underline">Note</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No customers yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      {note ? (
        <div className="mt-4 border border-border bg-card p-5">
          <p className="font-heading text-lg">{note.name || note.email}</p>
          <label className="label-luxe mt-3">Internal note</label>
          <textarea rows={3} value={note.notes} onChange={(e) => setNote({ ...note, notes: e.target.value })} className="field-luxe" />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={saveNote} className="btn-luxe">Save note</button>
            <button type="button" onClick={() => setNote(null)} className="btn-luxe-ghost">Cancel</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}