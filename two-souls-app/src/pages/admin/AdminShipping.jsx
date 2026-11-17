import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, statusTone } from '@/components/admin/ui';
import { formatDate, formatMoney } from '@/lib/format';

const BLANK_ZONE = { name: '', zoneType: 'city', cities: '', fee: 0, expressFee: 0, codAvailable: true, codFee: 0, minDays: 2, maxDays: 5, active: true };

export default function AdminShipping() {
  const [zones, setZones] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(BLANK_ZONE);
  const [settleDraft, setSettleDraft] = useState({ courier: '', periodStart: '', periodEnd: '', amountReceived: 0, courierCharges: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [zoneRows, courierRows, settlementRows, orderPage, settingsRows] = await Promise.all([
      storeApi.entities.ShippingZone.filter({}, { limit: 100 }),
      storeApi.entities.CourierAccount.filter({}, { limit: 50 }),
      storeApi.entities.CodSettlement.filter({}, { sort: '-created_date', limit: 100 }),
      storeApi.entities.Order.filter({ paymentMethod: 'cod' }, { limit: 500 }),
      storeApi.entities.BusinessSettings.filter({ key: 'main' }),
    ]);
    setZones(zoneRows.items || []);
    setCouriers(courierRows.items || []);
    setSettlements(settlementRows.items || []);
    setOrders(orderPage.items || []);
    setSettings(settingsRows[0] || null);
  };

  useEffect(() => {
    load();
  }, []);

  const codDelivered = useMemo(
    () => orders.filter((o) => o.orderStatus === 'delivered' && !o.settled),
    [orders]
  );
  const codExpected = codDelivered.reduce((s, o) => s + Number(o.total || 0), 0);

  const saveZone = async () => {
    if (!draft.name) return;
    setSaving(true);
    const payload = {
      ...draft,
      cities: typeof draft.cities === 'string' ? draft.cities.split(',').map((c) => c.trim()).filter(Boolean) : draft.cities,
      fee: Number(draft.fee) || 0,
      expressFee: Number(draft.expressFee) || 0,
      codFee: Number(draft.codFee) || 0,
      minDays: Number(draft.minDays) || 1,
      maxDays: Number(draft.maxDays) || 3,
    };
    delete payload.id;
    if (draft.id) await storeApi.entities.ShippingZone.update(draft.id, payload);
    else await storeApi.entities.ShippingZone.create(payload);
    setDraft(BLANK_ZONE);
    setSaving(false);
    load();
  };

  const saveShippingDefaults = async () => {
    if (!settings) return;
    setSaving(true);
    await storeApi.entities.BusinessSettings.update(settings.id, {
      freeShippingThreshold: Number(settings.freeShippingThreshold) || 0,
      standardShippingFee: Number(settings.standardShippingFee) || 0,
      expressShippingFee: Number(settings.expressShippingFee) || 0,
      codFee: Number(settings.codFee) || 0,
    });
    setSaving(false);
    load();
  };

  const createSettlement = async () => {
    if (!settleDraft.courier) return;
    setSaving(true);
    const expected = codDelivered.reduce((s, o) => s + Number(o.total || 0), 0);
    const received = Number(settleDraft.amountReceived) || 0;
    const charges = Number(settleDraft.courierCharges) || 0;
    await storeApi.entities.CodSettlement.create({
      ...settleDraft,
      amountExpected: expected,
      courierCharges: charges,
      amountReceived: received,
      difference: received - (expected - charges),
      ordersCount: codDelivered.length,
      settlementDate: new Date().toISOString(),
      status: 'pending',
    });
    setSaving(false);
    setSettleDraft({ courier: '', periodStart: '', periodEnd: '', amountReceived: 0, courierCharges: 0, notes: '' });
    load();
  };

  const reconcile = async (settlement) => {
    await storeApi.entities.CodSettlement.update(settlement.id, { status: 'reconciled' });
    for (const order of codDelivered) {
      await storeApi.entities.Order.update(order.id, { settled: true, paymentStatus: 'paid' });
    }
    load();
  };

  return (
    <div>
      <AdminHeading eyebrow="Logistics" title="Shipping & COD" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Delivery charges</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ['freeShippingThreshold', 'Free delivery above'],
              ['standardShippingFee', 'Standard fee'],
              ['expressShippingFee', 'Express fee'],
              ['codFee', 'COD handling fee'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="label-luxe">{label}</span>
                <input
                  type="number"
                  value={settings?.[key] ?? 0}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
                  className="field-luxe"
                />
              </label>
            ))}
          </div>
          <button type="button" onClick={saveShippingDefaults} disabled={saving} className="btn-luxe mt-4">Save charges</button>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Courier accounts</p>
          <ul className="mt-3 space-y-2 text-xs">
            {couriers.map((courier) => (
              <li key={courier.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                <div>
                  <p className="text-sm">{courier.name}</p>
                  <p className="text-muted-foreground">{courier.notes}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Pill tone={courier.apiConfigured ? 'green' : 'yellow'}>{courier.apiConfigured ? 'API connected' : 'Manual booking'}</Pill>
                  <Pill tone={courier.acceptsAlcoholFragrance ? 'green' : 'gray'}>
                    {courier.acceptsAlcoholFragrance ? 'Fragrance accepted' : 'Fragrance not confirmed'}
                  </Pill>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            No courier API is called until real credentials and written acceptance of alcohol-based fragrance shipments are in place. Bookings are recorded manually with courier and waybill details on each order.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Delivery zones</p>
            <button type="button" onClick={() => setDraft(BLANK_ZONE)} className="text-[10px] uppercase tracking-[0.16em] underline">New zone</button>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            {zones.map((zone) => (
              <li key={zone.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                <div>
                  <p className="text-sm">{zone.name}</p>
                  <p className="text-muted-foreground">{(zone.cities || []).join(', ') || '—'}</p>
                </div>
                <div className="text-right">
                  <p>{formatMoney(zone.fee)}</p>
                  <button type="button" onClick={() => setDraft({ ...zone, cities: (zone.cities || []).join(', ') })} className="mt-1 text-[10px] uppercase tracking-[0.16em] underline">Edit</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Zone name" className="field-luxe" />
            <input value={draft.cities} onChange={(e) => setDraft({ ...draft, cities: e.target.value })} placeholder="Cities, comma separated" className="field-luxe" />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} placeholder="Fee" className="field-luxe" />
              <input type="number" value={draft.expressFee} onChange={(e) => setDraft({ ...draft, expressFee: e.target.value })} placeholder="Express fee" className="field-luxe" />
              <input type="number" value={draft.minDays} onChange={(e) => setDraft({ ...draft, minDays: e.target.value })} placeholder="Min days" className="field-luxe" />
              <input type="number" value={draft.maxDays} onChange={(e) => setDraft({ ...draft, maxDays: e.target.value })} placeholder="Max days" className="field-luxe" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={draft.codAvailable} onChange={(e) => setDraft({ ...draft, codAvailable: e.target.checked })} /> COD available in this zone
            </label>
            <button type="button" onClick={saveZone} disabled={saving} className="btn-luxe">Save zone</button>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">COD reconciliation</p>
          <p className="mt-2 text-sm">
            {codDelivered.length} delivered cash orders awaiting settlement · {formatMoney(codExpected)} expected
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <select value={settleDraft.courier} onChange={(e) => setSettleDraft({ ...settleDraft, courier: e.target.value })} className="field-luxe">
              <option value="">Select courier</option>
              {couriers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input type="number" value={settleDraft.amountReceived} onChange={(e) => setSettleDraft({ ...settleDraft, amountReceived: e.target.value })} placeholder="Amount received" className="field-luxe" />
            <input type="number" value={settleDraft.courierCharges} onChange={(e) => setSettleDraft({ ...settleDraft, courierCharges: e.target.value })} placeholder="Courier charges" className="field-luxe" />
            <input type="date" value={settleDraft.periodStart} onChange={(e) => setSettleDraft({ ...settleDraft, periodStart: e.target.value })} className="field-luxe" />
          </div>
          <button type="button" onClick={createSettlement} disabled={saving || !settleDraft.courier} className="btn-luxe mt-3">Record settlement</button>

          <ul className="mt-4 space-y-2 text-xs">
            {settlements.map((settlement) => (
              <li key={settlement.id} className="border-b border-border/60 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span>{settlement.courier} · {settlement.ordersCount} orders</span>
                  <Pill tone={statusTone(settlement.status)}>{settlement.status}</Pill>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Expected {formatMoney(settlement.amountExpected)} · received {formatMoney(settlement.amountReceived)} · difference {formatMoney(settlement.difference)}
                </p>
                <p className="text-[10px] text-muted-foreground">{settlement.settlementDate ? formatDate(settlement.settlementDate) : ''}</p>
                {settlement.status !== 'reconciled' ? (
                  <button type="button" onClick={() => reconcile(settlement)} className="mt-1 text-[10px] uppercase tracking-[0.16em] underline">
                    Mark reconciled &amp; close COD orders
                  </button>
                ) : null}
              </li>
            ))}
            {settlements.length === 0 ? <li className="text-muted-foreground">No settlements recorded yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}