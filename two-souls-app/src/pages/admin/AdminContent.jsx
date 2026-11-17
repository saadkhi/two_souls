import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeApi } from '@/api/storeClient';
import { AdminHeading } from '@/components/admin/ui';

export default function AdminContent() {
  const [record, setRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const rows = await storeApi.entities.SiteContent.filter({ key: 'main' });
    setRecord(rows[0] || { key: 'main', announcement: {}, hero: {}, brandStory: {}, benefits: [], popup: {}, policies: {} });
  };

  useEffect(() => {
    load();
  }, []);

  if (!record) return <p className="text-sm text-muted-foreground">Loading storefront content…</p>;

  const setNested = (section, key, value) =>
    setRecord((r) => ({ ...r, [section]: { ...(r[section] || {}), [key]: value } }));

  const setBenefit = (index, key, value) =>
    setRecord((r) => ({
      ...r,
      benefits: (r.benefits || []).map((b, i) => (i === index ? { ...b, [key]: value } : b)),
    }));

  const save = async () => {
    setSaving(true);
    const payload = { ...record };
    delete payload.id;
    delete payload.created_date;
    delete payload.updated_date;
    delete payload.created_by_id;
    await storeApi.entities.SiteContent.update(record.id, payload);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const upload = async (section, key, event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const { file_url } = await storeApi.integrations.Core.UploadPublicFile({ file });
    setNested(section, key, file_url);
  };

  return (
    <div>
      <AdminHeading
        eyebrow="Storefront"
        title="Appearance & content"
        action={
          <div className="flex items-center gap-3">
            <Link to="/" target="_blank" className="text-[10px] uppercase tracking-[0.18em] underline">View store</Link>
            <button type="button" onClick={save} disabled={saving} className="btn-luxe">{saving ? 'Publishing…' : 'Publish changes'}</button>
          </div>
        }
      />
      {saved ? <p className="mb-4 border border-green-200 bg-green-50 p-3 text-xs text-green-800">Storefront updated.</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Announcement bar</p>
          <div className="mt-3 space-y-2">
            <input value={record.announcement?.text || ''} onChange={(e) => setNested('announcement', 'text', e.target.value)} placeholder="Announcement text" className="field-luxe" />
            <div className="grid grid-cols-2 gap-2">
              <input value={record.announcement?.ctaLabel || ''} onChange={(e) => setNested('announcement', 'ctaLabel', e.target.value)} placeholder="CTA label" className="field-luxe" />
              <input value={record.announcement?.ctaLink || ''} onChange={(e) => setNested('announcement', 'ctaLink', e.target.value)} placeholder="CTA link" className="field-luxe" />
              <label className="text-[11px]">
                Background
                <input type="color" value={record.announcement?.bgColor || '#171717'} onChange={(e) => setNested('announcement', 'bgColor', e.target.value)} className="mt-1 block h-9 w-full border border-border" />
              </label>
              <label className="text-[11px]">
                Text colour
                <input type="color" value={record.announcement?.textColor || '#F5F0E7'} onChange={(e) => setNested('announcement', 'textColor', e.target.value)} className="mt-1 block h-9 w-full border border-border" />
              </label>
              <input type="date" value={record.announcement?.startDate?.slice(0, 10) || ''} onChange={(e) => setNested('announcement', 'startDate', e.target.value)} className="field-luxe" />
              <input type="date" value={record.announcement?.endDate?.slice(0, 10) || ''} onChange={(e) => setNested('announcement', 'endDate', e.target.value)} className="field-luxe" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={record.announcement?.active !== false} onChange={(e) => setNested('announcement', 'active', e.target.checked)} /> Show announcement bar
            </label>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Hero</p>
          <div className="mt-3 space-y-2">
            <input value={record.hero?.eyebrow || ''} onChange={(e) => setNested('hero', 'eyebrow', e.target.value)} placeholder="Eyebrow" className="field-luxe" />
            <textarea rows={2} value={record.hero?.headline || ''} onChange={(e) => setNested('hero', 'headline', e.target.value)} placeholder="Headline (line break allowed)" className="field-luxe" />
            <textarea rows={2} value={record.hero?.subheadline || ''} onChange={(e) => setNested('hero', 'subheadline', e.target.value)} placeholder="Supporting text" className="field-luxe" />
            <div className="grid grid-cols-2 gap-2">
              <input value={record.hero?.ctaPrimaryLabel || ''} onChange={(e) => setNested('hero', 'ctaPrimaryLabel', e.target.value)} placeholder="Primary CTA" className="field-luxe" />
              <input value={record.hero?.ctaPrimaryLink || ''} onChange={(e) => setNested('hero', 'ctaPrimaryLink', e.target.value)} placeholder="/shop" className="field-luxe" />
              <input value={record.hero?.ctaSecondaryLabel || ''} onChange={(e) => setNested('hero', 'ctaSecondaryLabel', e.target.value)} placeholder="Secondary CTA" className="field-luxe" />
              <input value={record.hero?.ctaSecondaryLink || ''} onChange={(e) => setNested('hero', 'ctaSecondaryLink', e.target.value)} placeholder="/shop?filter=bestsellers" className="field-luxe" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label>Desktop image<input type="file" accept="image/*" onChange={(e) => upload('hero', 'desktopImage', e)} className="mt-1 block w-full text-[10px]" /></label>
              <label>Mobile image<input type="file" accept="image/*" onChange={(e) => upload('hero', 'mobileImage', e)} className="mt-1 block w-full text-[10px]" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['desktopImage', 'mobileImage'].map((key) => record.hero?.[key] ? (
                <img key={key} src={record.hero[key]} alt={key} className="h-20 w-full border border-border object-cover" />
              ) : null)}
            </div>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Brand story</p>
          <div className="mt-3 space-y-2">
            <input value={record.brandStory?.title || ''} onChange={(e) => setNested('brandStory', 'title', e.target.value)} placeholder="Title" className="field-luxe" />
            <textarea rows={4} value={record.brandStory?.body || ''} onChange={(e) => setNested('brandStory', 'body', e.target.value)} placeholder="Brand story" className="field-luxe" />
            <input value={record.aboutBody || ''} onChange={(e) => setRecord({ ...record, aboutBody: e.target.value })} placeholder="About page introduction" className="field-luxe" />
            <label className="text-[11px]">Story image<input type="file" accept="image/*" onChange={(e) => upload('brandStory', 'image', e)} className="mt-1 block w-full text-[10px]" /></label>
          </div>
        </section>

        <section className="border border-border bg-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Brand benefits</p>
          <div className="mt-3 space-y-2">
            {(record.benefits || []).map((benefit, index) => (
              <div key={index} className="grid gap-2 border border-border/60 p-2">
                <input value={benefit.title || ''} onChange={(e) => setBenefit(index, 'title', e.target.value)} placeholder="Title" className="field-luxe" />
                <input value={benefit.text || ''} onChange={(e) => setBenefit(index, 'text', e.target.value)} placeholder="Supporting line" className="field-luxe" />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRecord((r) => ({ ...r, benefits: [...(r.benefits || []), { title: '', text: '' }] }))}
              className="text-[10px] uppercase tracking-[0.16em] underline"
            >
              Add benefit
            </button>
          </div>
        </section>

        <section className="border border-border bg-card p-5 lg:col-span-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Policies</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {['shipping', 'returns', 'privacy', 'terms'].map((key) => (
              <label key={key} className="block">
                <span className="label-luxe">{key}</span>
                <textarea rows={4} value={record.policies?.[key] || ''} onChange={(e) => setNested('policies', key, e.target.value)} className="field-luxe" />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}