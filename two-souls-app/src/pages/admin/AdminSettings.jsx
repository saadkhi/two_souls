import { useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill } from '@/components/admin/ui';

export default function AdminSettings() {
  const [s, setS] = useState(null);
  const [counts, setCounts] = useState({ products: 0, collections: 0, zones: 0, couriers: 0, images: 0, policy: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const [rows, productPage, collections, zones, couriers, content] = await Promise.all([
      storeApi.entities.BusinessSettings.filter({ key: 'main' }),
      storeApi.entities.Product.filter({}, { limit: 200 }),
      storeApi.entities.Collection.filter({}, { limit: 50 }),
      storeApi.entities.ShippingZone.filter({}, { limit: 50 }),
      storeApi.entities.CourierAccount.filter({}, { limit: 50 }),
      storeApi.entities.SiteContent.filter({ key: 'main' }),
    ]);
    setS(rows[0] || { key: 'main', paymentMethods: {} });
    const products = productPage.items || [];
    setCounts({
      products: products.length,
      collections: collections.items?.length || 0,
      zones: zones.items?.length || 0,
      couriers: couriers.items?.length || 0,
      images: products.filter((p) => (p.images || []).length).length,
      policy: !!content[0]?.policies?.returns,
    });
  };

  useEffect(() => {
    load();
  }, []);

  if (!s) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setS((prev) => ({ ...prev, [key]: value }));
  };
  const setPay = (group, key, value) =>
    setS((prev) => ({
      ...prev,
      paymentMethods: {
        ...(prev.paymentMethods || {}),
        [group]: { ...((prev.paymentMethods || {})[group] || {}), [key]: value },
      },
    }));

  const save = async () => {
    setSaving(true);
    const payload = { ...s };
    delete payload.id;
    delete payload.created_date;
    delete payload.updated_date;
    delete payload.created_by_id;
    payload.freeShippingThreshold = Number(payload.freeShippingThreshold) || 0;
    payload.standardShippingFee = Number(payload.standardShippingFee) || 0;
    payload.expressShippingFee = Number(payload.expressShippingFee) || 0;
    payload.codFee = Number(payload.codFee) || 0;
    payload.defaultTaxRate = Number(payload.defaultTaxRate) || 0;
    await storeApi.entities.BusinessSettings.update(s.id, payload);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const uploadLogo = async (key, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { file_url } = await storeApi.integrations.Core.UploadPublicFile({ file });
    setS((prev) => ({ ...prev, [key]: file_url }));
  };

  const pay = s.paymentMethods || {};
  const checklist = [
    { label: 'Brand name', done: !!s.brandName },
    { label: 'Logo uploaded', done: !!s.logoUrl },
    { label: 'Contact number & support email', done: !!s.contactPhone && !!s.supportEmail },
    { label: 'WhatsApp number', done: !!s.whatsapp },
    { label: 'Dispatch city & address', done: !!s.dispatchCity && !!s.dispatchAddress },
    { label: 'Collections created', done: counts.collections > 0 },
    { label: 'Fragrances in catalogue', done: counts.products > 0 },
    { label: 'Fragrance photography', done: counts.images > 0 },
    { label: 'Payment method enabled', done: pay?.cod?.enabled !== false || pay?.bank?.enabled === true },
    { label: 'Bank details', done: pay?.bank?.enabled !== true || (!!pay?.bank?.bankName && !!pay?.bank?.accountNumber) },
    { label: 'Courier accounts', done: counts.couriers > 0 },
    { label: 'Delivery charges', done: Number(s.standardShippingFee) > 0 },
    { label: 'Delivery zones', done: counts.zones > 0 },
    { label: 'Return policy', done: counts.policy },
    { label: 'Social links', done: !!s.instagram || !!s.facebook || !!s.tiktok },
    { label: 'Tax settings reviewed', done: !!s.taxReviewed },
  ];
  const essential = checklist.slice(0, 14).filter((item) => !item.done);
  const ready = essential.length === 0;

  return (
    <div>
      <AdminHeading
        eyebrow="Configuration"
        title="Business settings"
        action={<button type="button" onClick={save} disabled={saving} className="btn-luxe">{saving ? 'Saving…' : 'Save settings'}</button>}
      />
      {saved ? <p className="mb-4 border border-green-200 bg-green-50 p-3 text-xs text-green-800">Settings saved and live on the storefront.</p> : null}

      <div className={`mb-6 border p-4 text-xs ${ready ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        {ready
          ? 'All essential settings are complete. Review your payment and shipping integrations before promoting the store.'
          : `Not production-ready yet — ${essential.length} essential item(s) outstanding: ${essential.map((i) => i.label).join(', ')}.`}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Brand</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={s.brandName || ''} onChange={set('brandName')} placeholder="Public brand name" className="field-luxe" />
            <input value={s.legalName || ''} onChange={set('legalName')} placeholder="Legal business name" className="field-luxe" />
            <input value={s.wordmark || ''} onChange={set('wordmark')} placeholder="Wordmark (header lockup)" className="field-luxe sm:col-span-2" />
            <textarea rows={2} value={s.brandDescription || ''} onChange={set('brandDescription')} placeholder="Brand description" className="field-luxe sm:col-span-2" />
            <input value={s.registrationDetails || ''} onChange={set('registrationDetails')} placeholder="Business registration details" className="field-luxe sm:col-span-2" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
            <label>
              Logo
              <input type="file" accept="image/*" onChange={(e) => uploadLogo('logoUrl', e)} className="mt-1 block w-full text-[10px]" />
              {s.logoUrl ? <img src={s.logoUrl} alt="Logo" className="mt-2 h-12 object-contain" /> : null}
            </label>
            <label>
              Favicon
              <input type="file" accept="image/*" onChange={(e) => uploadLogo('faviconUrl', e)} className="mt-1 block w-full text-[10px]" />
              {s.faviconUrl ? <img src={s.faviconUrl} alt="Favicon" className="mt-2 h-8 w-8 object-contain" /> : null}
            </label>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Contact & dispatch</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={s.contactPhone || ''} onChange={set('contactPhone')} placeholder="Contact number" className="field-luxe" />
            <input value={s.whatsapp || ''} onChange={set('whatsapp')} placeholder="WhatsApp number" className="field-luxe" />
            <input value={s.supportEmail || ''} onChange={set('supportEmail')} placeholder="Support email" className="field-luxe sm:col-span-2" />
            <input value={s.address || ''} onChange={set('address')} placeholder="Business address" className="field-luxe sm:col-span-2" />
            <input value={s.dispatchCity || ''} onChange={set('dispatchCity')} placeholder="Dispatch city" className="field-luxe" />
            <input value={s.dispatchAddress || ''} onChange={set('dispatchAddress')} placeholder="Dispatch address" className="field-luxe" />
            <input value={s.returnAddress || ''} onChange={set('returnAddress')} placeholder="Return address" className="field-luxe sm:col-span-2" />
            <input value={s.instagram || ''} onChange={set('instagram')} placeholder="Instagram URL" className="field-luxe" />
            <input value={s.facebook || ''} onChange={set('facebook')} placeholder="Facebook URL" className="field-luxe" />
            <input value={s.tiktok || ''} onChange={set('tiktok')} placeholder="TikTok URL" className="field-luxe" />
            <input value={s.invoicePrefix || ''} onChange={set('invoicePrefix')} placeholder="Invoice prefix" className="field-luxe" />
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Payments</p>
          <div className="mt-3 space-y-3 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pay?.cod?.enabled !== false} onChange={(e) => setPay('cod', 'enabled', e.target.checked)} />
              Cash on delivery
            </label>
            <input type="number" value={pay?.cod?.fee ?? 0} onChange={(e) => setPay('cod', 'fee', Number(e.target.value))} placeholder="COD handling fee" className="field-luxe" />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={pay?.bank?.enabled === true} onChange={(e) => setPay('bank', 'enabled', e.target.checked)} />
              Bank transfer
            </label>
            {pay?.bank?.enabled ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={pay?.bank?.bankName || ''} onChange={(e) => setPay('bank', 'bankName', e.target.value)} placeholder="Bank name" className="field-luxe" />
                <input value={pay?.bank?.accountTitle || ''} onChange={(e) => setPay('bank', 'accountTitle', e.target.value)} placeholder="Account title" className="field-luxe" />
                <input value={pay?.bank?.accountNumber || ''} onChange={(e) => setPay('bank', 'accountNumber', e.target.value)} placeholder="Account number" className="field-luxe" />
                <input value={pay?.bank?.iban || ''} onChange={(e) => setPay('bank', 'iban', e.target.value)} placeholder="IBAN" className="field-luxe" />
                <textarea rows={2} value={pay?.bank?.instructions || ''} onChange={(e) => setPay('bank', 'instructions', e.target.value)} placeholder="Transfer instructions" className="field-luxe sm:col-span-2" />
              </div>
            ) : null}
            <div className="border-t border-border pt-3">
              {['safepay', 'jazzcash', 'easypaisa'].map((key) => (
                <div key={key} className="mb-2 flex items-center justify-between gap-2">
                  <span className="capitalize">{key}</span>
                  <Pill tone="yellow">Awaiting merchant credentials</Pill>
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These gateways stay off until merchant credentials are stored as app secrets and their server-side verification is tested. Checkout never treats a redirect as proof of payment.
              </p>
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tax & locale</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={s.currency || ''} onChange={set('currency')} placeholder="Currency" className="field-luxe" />
            <input value={s.currencySymbol || ''} onChange={set('currencySymbol')} placeholder="Currency symbol" className="field-luxe" />
            <input value={s.locale || ''} onChange={set('locale')} placeholder="Locale" className="field-luxe" />
            <input value={s.timezone || ''} onChange={set('timezone')} placeholder="Timezone" className="field-luxe" />
            <input value={s.taxRegistrationNumber || ''} onChange={set('taxRegistrationNumber')} placeholder="Tax registration number" className="field-luxe sm:col-span-2" />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!s.taxEnabled} onChange={set('taxEnabled')} /> Apply tax
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!s.taxInclusive} onChange={set('taxInclusive')} /> Prices include tax
            </label>
            <input type="number" value={s.defaultTaxRate ?? 0} onChange={set('defaultTaxRate')} placeholder="Default tax rate (%)" className="field-luxe" />
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={!!s.taxReviewed} onChange={set('taxReviewed')} /> Tax approach reviewed with an adviser
            </label>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            No tax rate is assumed. Set your own rate based on professional advice.
          </p>
        </section>
      </div>

      <section className="mt-6 border border-border bg-card p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Setup checklist</p>
        <ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {checklist.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <Pill tone={item.done ? 'green' : 'yellow'}>{item.done ? 'Done' : 'Pending'}</Pill>
              {item.label}
            </li>
          ))}
          <li className="flex items-center gap-2"><Pill tone="gray">Unavailable</Pill>Email notifications (no sending domain connected)</li>
          <li className="flex items-center gap-2"><Pill tone="gray">Dashboard</Pill>Custom domain — connect under Domains</li>
        </ul>
      </section>
    </div>
  );
}