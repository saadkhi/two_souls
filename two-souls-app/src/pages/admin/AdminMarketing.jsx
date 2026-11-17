import { useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, statusTone } from '@/components/admin/ui';
import { formatDate, formatMoney } from '@/lib/format';

const BLANK_COUPON = { code: '', description: '', type: 'percentage', value: 10, minOrderAmount: 0, scope: 'storewide', scopeValue: '', usageLimit: 0, perCustomerLimit: 1, startsAt: '', endsAt: '', active: true };
const BLANK_PROMO = { title: '', campaignType: 'Seasonal', placement: 'banner', headline: '', body: '', image: '', ctaLabel: '', ctaLink: '', startDate: '', endDate: '', desktopVisible: true, mobileVisible: true, active: true };

export default function AdminMarketing() {
  const [coupons, setCoupons] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [coupon, setCoupon] = useState(BLANK_COUPON);
  const [promo, setPromo] = useState(BLANK_PROMO);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [couponRows, promoRows] = await Promise.all([
      storeApi.entities.Coupon.filter({}, { sort: '-created_date', limit: 100 }),
      storeApi.entities.Promotion.filter({}, { sort: '-created_date', limit: 100 }),
    ]);
    setCoupons(couponRows.items || []);
    setPromotions(promoRows.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveCoupon = async () => {
    if (!coupon.code) return;
    setSaving(true);
    const payload = { ...coupon, code: coupon.code.toUpperCase(), value: Number(coupon.value) || 0, minOrderAmount: Number(coupon.minOrderAmount) || 0, usageLimit: Number(coupon.usageLimit) || 0, perCustomerLimit: Number(coupon.perCustomerLimit) || 1 };
    delete payload.id;
    if (coupon.id) await storeApi.entities.Coupon.update(coupon.id, payload);
    else await storeApi.entities.Coupon.create({ ...payload, usedCount: 0 });
    setCoupon(BLANK_COUPON);
    setSaving(false);
    load();
  };

  const savePromo = async () => {
    if (!promo.title) return;
    setSaving(true);
    const payload = { ...promo };
    delete payload.id;
    if (promo.id) await storeApi.entities.Promotion.update(promo.id, payload);
    else await storeApi.entities.Promotion.create(payload);
    setPromo(BLANK_PROMO);
    setSaving(false);
    load();
  };

  const toggle = async (entity, record, key = 'active') => {
    await entity.update(record.id, { [key]: !record[key] });
    load();
  };

  return (
    <div>
      <AdminHeading eyebrow="Growth" title="Marketing" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Offer codes</p>
            <button type="button" onClick={() => setCoupon(BLANK_COUPON)} className="text-[10px] uppercase tracking-[0.16em] underline">New code</button>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            {coupons.map((row) => (
              <li key={row.id} className="border-b border-border/60 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.code}</span>
                  <div className="flex items-center gap-2">
                    <Pill tone={statusTone(row.active ? 'active' : 'draft')}>{row.active ? 'Active' : 'Paused'}</Pill>
                    <button type="button" onClick={() => setCoupon({ ...row, startsAt: row.startsAt || '', endsAt: row.endsAt || '' })} className="underline">Edit</button>
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {row.type === 'percentage' ? `${row.value}% off` : `${formatMoney(row.value)} off`} · {row.scope}
                  {row.minOrderAmount ? ` · min ${formatMoney(row.minOrderAmount)}` : ''}
                  {row.endsAt ? ` · ends ${formatDate(row.endsAt)}` : ''}
                </p>
                <p className="text-[10px] text-muted-foreground">Used {row.usedCount || 0}{row.usageLimit ? ` of ${row.usageLimit}` : ''}</p>
              </li>
            ))}
            {coupons.length === 0 ? <li className="text-muted-foreground">No offer codes yet.</li> : null}
          </ul>

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <input value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} placeholder="Code e.g. EID15" className="field-luxe uppercase" />
            <input value={coupon.description} onChange={(e) => setCoupon({ ...coupon, description: e.target.value })} placeholder="Internal description" className="field-luxe" />
            <div className="grid grid-cols-2 gap-2">
              <select value={coupon.type} onChange={(e) => setCoupon({ ...coupon, type: e.target.value })} className="field-luxe">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
              <input type="number" value={coupon.value} onChange={(e) => setCoupon({ ...coupon, value: e.target.value })} placeholder="Value" className="field-luxe" />
              <input type="number" value={coupon.minOrderAmount} onChange={(e) => setCoupon({ ...coupon, minOrderAmount: e.target.value })} placeholder="Minimum order" className="field-luxe" />
              <input type="number" value={coupon.usageLimit} onChange={(e) => setCoupon({ ...coupon, usageLimit: e.target.value })} placeholder="Usage limit (0 = none)" className="field-luxe" />
              <input type="date" value={coupon.startsAt?.slice(0, 10) || ''} onChange={(e) => setCoupon({ ...coupon, startsAt: e.target.value })} className="field-luxe" />
              <input type="date" value={coupon.endsAt?.slice(0, 10) || ''} onChange={(e) => setCoupon({ ...coupon, endsAt: e.target.value })} className="field-luxe" />
            </div>
            <button type="button" onClick={saveCoupon} disabled={saving} className="btn-luxe">Save code</button>
          </div>
        </div>

        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Campaigns & banners</p>
            <button type="button" onClick={() => setPromo(BLANK_PROMO)} className="text-[10px] uppercase tracking-[0.16em] underline">New campaign</button>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            {promotions.map((row) => (
              <li key={row.id} className="border-b border-border/60 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{row.title}</span>
                  <div className="flex items-center gap-2">
                    <Pill tone={statusTone(row.active ? 'active' : 'draft')}>{row.active ? 'Live' : 'Paused'}</Pill>
                    <button type="button" onClick={() => setPromo({ ...row, startDate: row.startDate || '', endDate: row.endDate || '' })} className="underline">Edit</button>
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">{row.campaignType} · {row.placement} · {row.ctaLink || 'no link'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {row.startDate ? formatDate(row.startDate) : 'Always on'} — {row.endDate ? formatDate(row.endDate) : 'no end date'}
                </p>
              </li>
            ))}
            {promotions.length === 0 ? <li className="text-muted-foreground">No campaigns yet.</li> : null}
          </ul>

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <input value={promo.title} onChange={(e) => setPromo({ ...promo, title: e.target.value })} placeholder="Campaign title" className="field-luxe" />
            <div className="grid grid-cols-2 gap-2">
              <input value={promo.campaignType} onChange={(e) => setPromo({ ...promo, campaignType: e.target.value })} placeholder="Type e.g. Eid Collection" className="field-luxe" />
              <select value={promo.placement} onChange={(e) => setPromo({ ...promo, placement: e.target.value })} className="field-luxe">
                {['banner', 'hero', 'popup', 'announcement', 'landing'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input value={promo.headline} onChange={(e) => setPromo({ ...promo, headline: e.target.value })} placeholder="Headline" className="field-luxe" />
              <input value={promo.ctaLabel} onChange={(e) => setPromo({ ...promo, ctaLabel: e.target.value })} placeholder="CTA label" className="field-luxe" />
              <input value={promo.ctaLink} onChange={(e) => setPromo({ ...promo, ctaLink: e.target.value })} placeholder="CTA link" className="field-luxe" />
              <input value={promo.image} onChange={(e) => setPromo({ ...promo, image: e.target.value })} placeholder="Image URL" className="field-luxe" />
              <input type="date" value={promo.startDate} onChange={(e) => setPromo({ ...promo, startDate: e.target.value })} className="field-luxe" />
              <input type="date" value={promo.endDate} onChange={(e) => setPromo({ ...promo, endDate: e.target.value })} className="field-luxe" />
            </div>
            <button type="button" onClick={savePromo} disabled={saving} className="btn-luxe">Save campaign</button>
          </div>
        </div>
      </div>

      <div className="mt-6 border border-border bg-card p-5 text-[11px] leading-relaxed text-muted-foreground">
        Banners and campaigns here drive scheduled placements. The announcement bar text and colours live under Appearance, so every message shows in one place.
      </div>
    </div>
  );
}