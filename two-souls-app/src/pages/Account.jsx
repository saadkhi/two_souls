import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeApi } from '@/api/storeClient';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, formatDate, formatMoney, PROVINCES } from '@/lib/format';

const TABS = [
  { key: 'orders', label: 'My orders' },
  { key: 'addresses', label: 'Address book' },
  { key: 'profile', label: 'Profile' },
];

const EMPTY_ADDRESS = {
  label: 'Home', fullName: '', phone: '', province: '', city: '', district: '',
  area: '', street: '', house: '', landmark: '', postalCode: '', deliveryInstructions: '', isDefault: false,
};

export default function Account() {
  const [tab, setTab] = useState('orders');
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [draft, setDraft] = useState(EMPTY_ADDRESS);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const me = await storeApi.auth.me();
    setUser(me);
    const [orderRows, addressRows] = await Promise.all([
      storeApi.entities.Order.filter({ userEmail: me.email }, { sort: '-created_date', limit: 50 }),
      storeApi.entities.Address.filter({}, { sort: '-created_date', limit: 50 }),
    ]);
    setOrders(orderRows.items || []);
    setAddresses(addressRows.items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const set = (key) => (event) =>
    setDraft((d) => ({ ...d, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const saveAddress = async (event) => {
    event.preventDefault();
    setSaving(true);
    if (draft.id) await storeApi.entities.Address.update(draft.id, draft);
    else await storeApi.entities.Address.create(draft);
    setDraft(EMPTY_ADDRESS);
    setShowForm(false);
    setSaving(false);
    const rows = await storeApi.entities.Address.filter({}, { sort: '-created_date', limit: 50 });
    setAddresses(rows.items || []);
  };

  const removeAddress = async (id) => {
    await storeApi.entities.Address.delete(id);
    setAddresses((list) => list.filter((a) => a.id !== id));
  };

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="eyebrow">Your account</p>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">{user?.full_name || 'Welcome'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] ${tab === item.key ? 'bg-foreground text-background' : 'border border-border'}`}
          >
            {item.label}
          </button>
        ))}
        <Link to="/wishlist" className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] border border-border">Wishlist</Link>
      </div>

      {loading ? (
        <p className="py-16 text-sm text-muted-foreground">Loading your account…</p>
      ) : tab === 'orders' ? (
        <div className="mt-8 space-y-4">
          {orders.length === 0 ? (
            <div className="border border-border bg-card p-8 text-center">
              <p className="font-heading text-2xl">No orders yet</p>
              <Link to="/shop" className="btn-luxe mt-6">Explore the collection</Link>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="border border-border bg-card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <p className="font-heading text-xl">{order.orderNumber}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {formatDate(order.created_date)} · {order.items?.length || 0} items
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
                    </p>
                    <p className="mt-1 text-sm">{formatMoney(order.total)}</p>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(order.items || []).map((item) => (
                    <li key={`${item.sku}-${item.size}`} className="flex justify-between">
                      <span>{item.name} · {item.size} × {item.quantity}</span>
                      <span>{formatMoney(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 grid gap-3 border-t border-border pt-3 text-[11px] sm:grid-cols-3">
                  <div>
                    <p className="uppercase tracking-[0.18em] text-muted-foreground">Payment</p>
                    <p className="mt-1">
                      {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod === 'bank_transfer' ? 'Bank transfer' : order.paymentMethod}
                      {' · '}{PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em] text-muted-foreground">Courier</p>
                    <p className="mt-1">{order.courier || 'Not booked yet'}{order.trackingNumber ? ` · ${order.trackingNumber}` : ''}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.18em] text-muted-foreground">Delivering to</p>
                    <p className="mt-1">{[order.house, order.street, order.area, order.city].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
                <Link to="/track" className="link-underline mt-4 inline-block">Track this order</Link>
              </div>
            ))
          )}
        </div>
      ) : tab === 'addresses' ? (
        <div className="mt-8">
          <button type="button" onClick={() => { setDraft(EMPTY_ADDRESS); setShowForm(true); }} className="btn-luxe">
            Add an address
          </button>

          {showForm ? (
            <form onSubmit={saveAddress} className="mt-6 grid gap-4 border border-border bg-card p-6 sm:grid-cols-2">
              {[
                ['label', 'Label'], ['fullName', 'Full name'], ['phone', 'Mobile number'],
                ['city', 'City'], ['district', 'District'], ['area', 'Area / locality'],
                ['street', 'Street address'], ['house', 'House / building'], ['landmark', 'Landmark'], ['postalCode', 'Postal code'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="label-luxe" htmlFor={`addr-${key}`}>{label}</label>
                  <input id={`addr-${key}`} value={draft[key] || ''} onChange={set(key)} className="field-luxe" required={['fullName', 'phone', 'city', 'street'].includes(key)} />
                </div>
              ))}
              <div>
                <label className="label-luxe" htmlFor="addr-province">Province / region</label>
                <select id="addr-province" value={draft.province || ''} onChange={set('province')} className="field-luxe">
                  <option value="">Select region</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label-luxe" htmlFor="addr-deliveryInstructions">Delivery instructions</label>
                <textarea id="addr-deliveryInstructions" value={draft.deliveryInstructions || ''} onChange={set('deliveryInstructions')} rows={2} className="field-luxe" />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <button type="submit" disabled={saving} className="btn-luxe">{saving ? 'Saving…' : 'Save address'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-luxe-ghost">Cancel</button>
              </div>
            </form>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <div key={address.id} className="border border-border bg-card p-5 text-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{address.label}</p>
                <p className="mt-2 font-heading text-lg">{address.fullName}</p>
                <p className="mt-1 text-muted-foreground">
                  {[address.house, address.street, address.area, address.city, address.province].filter(Boolean).join(', ')}
                </p>
                <p className="mt-1">{address.phone}</p>
                <div className="mt-4 flex gap-4 text-[10px] uppercase tracking-[0.2em]">
                  <button type="button" onClick={() => { setDraft(address); setShowForm(true); }} className="underline">Edit</button>
                  <button type="button" onClick={() => removeAddress(address.id)} className="underline text-destructive">Remove</button>
                </div>
              </div>
            ))}
            {addresses.length === 0 ? <p className="text-sm text-muted-foreground">No saved addresses yet.</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-8 max-w-lg border border-border bg-card p-6 text-sm">
          <dl className="space-y-3">
            <div><dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Name</dt><dd className="mt-1">{user?.full_name || '—'}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Email</dt><dd className="mt-1">{user?.email}</dd></div>
            <div><dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Orders placed</dt><dd className="mt-1">{orders.length}</dd></div>
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            To change your name or email, contact our client care team. For saved delivery details, use the address book.
          </p>
        </div>
      )}
    </div>
  );
}