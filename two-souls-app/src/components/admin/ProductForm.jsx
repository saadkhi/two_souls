import { useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const FAMILIES = ['Woody', 'Oud', 'Amber', 'Floral', 'Fresh', 'Citrus', 'Aquatic', 'Oriental', 'Aromatic', 'Gourmand', 'Spicy', 'Musky'];
const CONCENTRATIONS = ['Eau de Parfum', 'Eau de Toilette', 'Extrait de Parfum', 'Parfum'];

const blankVariant = () => ({
  id: `v-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  size: '50ml', sku: '', price: 0, salePrice: '', stock: 0, lowStockThreshold: 5, barcode: '', active: true,
});

export default function ProductForm({ open, onOpenChange, product, collections, onSaved }) {
  const [form, setForm] = useState(() => normalize(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  function normalize(p) {
    return {
      id: p?.id,
      name: p?.name || '',
      slug: p?.slug || '',
      sku: p?.sku || '',
      description: p?.description || '',
      story: p?.story || '',
      collection: p?.collection || collections[0]?.name || '',
      gender: p?.gender || 'Unisex',
      family: p?.family || 'Woody',
      concentration: p?.concentration || 'Eau de Parfum',
      topNotes: (p?.topNotes || []).join(', '),
      heartNotes: (p?.heartNotes || []).join(', '),
      baseNotes: (p?.baseNotes || []).join(', '),
      longevity: p?.longevity || '',
      sillage: p?.sillage || '',
      ingredients: p?.ingredients || '',
      usage: p?.usage || '',
      storage: p?.storage || '',
      safetyWarnings: p?.safetyWarnings || '',
      images: p?.images || [],
      status: p?.status || 'draft',
      featured: !!p?.featured,
      bestseller: !!p?.bestseller,
      isNew: !!p?.isNew,
      isGiftSet: !!p?.isGiftSet,
      isDiscoverySet: !!p?.isDiscoverySet,
      variants: p?.variants?.length ? p.variants : [blankVariant()],
      batches: p?.batches || [],
      packaging: p?.packaging || {},
      shippingClass: p?.shippingClass || 'Alcohol-based fragrance',
      handlingInstructions: p?.handlingInstructions || '',
      manufacturer: p?.manufacturer || '',
      countryOfOrigin: p?.countryOfOrigin || 'Pakistan',
      netVolume: p?.netVolume || '',
      complianceStatus: p?.complianceStatus || 'pending',
      relatedSlugs: p?.relatedSlugs || [],
    };
  }

  if (!open) return null;

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setVariant = (index, key, value) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));
  };

  const uploadImages = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const { file_url } = await storeApi.integrations.Core.UploadPublicFile({ file });
      uploaded.push(file_url);
    }
    setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }));
    setUploading(false);
  };

  const save = async () => {
    setError('');
    if (!form.name.trim()) {
      setError('A fragrance name is required.');
      return;
    }
    const variants = form.variants
      .filter((v) => v.size && Number(v.price) > 0)
      .map((v) => ({
        ...v,
        price: Number(v.price) || 0,
        salePrice: v.salePrice === '' ? null : Number(v.salePrice),
        stock: Number(v.stock) || 0,
        lowStockThreshold: Number(v.lowStockThreshold) || 5,
        sku: v.sku || `${form.sku || form.slug}-${v.size}`,
      }));
    if (!variants.length) {
      setError('Add at least one size with a price.');
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      slug: (form.slug || form.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      topNotes: form.topNotes.split(',').map((s) => s.trim()).filter(Boolean),
      heartNotes: form.heartNotes.split(',').map((s) => s.trim()).filter(Boolean),
      baseNotes: form.baseNotes.split(',').map((s) => s.trim()).filter(Boolean),
      variants,
      rating: product?.rating || 0,
      reviewCount: product?.reviewCount || 0,
      soldCount: product?.soldCount || 0,
    };
    delete payload.relatedSlugsInput;

    if (form.id) await storeApi.entities.Product.update(form.id, payload);
    else await storeApi.entities.Product.create(payload);
    setSaving(false);
    onSaved();
    onOpenChange(false);
  };

  const field = (key, label, options = {}) => (
    <label className="block">
      <span className="label-luxe">{label}</span>
      <input
        value={form[key] || ''}
        onChange={set(key)}
        type={options.type || 'text'}
        className="field-luxe"
        placeholder={options.placeholder || ''}
      />
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-border bg-card p-0">
        <DialogTitle className="sr-only">Fragrance details</DialogTitle>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="font-heading text-2xl">{form.id ? 'Edit fragrance' : 'New fragrance'}</h2>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Identity</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {field('name', 'Fragrance name')}
              {field('slug', 'URL slug', { placeholder: 'noir-oud' })}
              {field('sku', 'Product SKU')}
              <label className="block">
                <span className="label-luxe">Collection</span>
                <select value={form.collection} onChange={set('collection')} className="field-luxe">
                  {collections.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label-luxe">Gender positioning</span>
                <select value={form.gender} onChange={set('gender')} className="field-luxe">
                  {['Men', 'Women', 'Unisex'].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label-luxe">Fragrance family</span>
                <select value={form.family} onChange={set('family')} className="field-luxe">
                  {FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label-luxe">Concentration</span>
                <select value={form.concentration} onChange={set('concentration')} className="field-luxe">
                  {CONCENTRATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label-luxe">Status</span>
                <select value={form.status} onChange={set('status')} className="field-luxe">
                  <option value="draft">Draft</option>
                  <option value="active">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="block">
                <span className="label-luxe">Description</span>
                <textarea rows={2} value={form.description} onChange={set('description')} className="field-luxe" />
              </label>
              <label className="block">
                <span className="label-luxe">Fragrance story</span>
                <textarea rows={2} value={form.story} onChange={set('story')} className="field-luxe" />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              {[['featured', 'Feature on homepage'], ['bestseller', 'Mark as bestseller'], ['isNew', 'Mark as new arrival'], ['isGiftSet', 'Gift set'], ['isDiscoverySet', 'Discovery set']].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form[key]} onChange={set(key)} /> {label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Notes & performance</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {field('topNotes', 'Top notes (comma separated)')}
              {field('heartNotes', 'Heart notes (comma separated)')}
              {field('baseNotes', 'Base notes (comma separated)')}
              {field('longevity', 'Longevity', { placeholder: '8–10 hours' })}
              {field('sillage', 'Sillage', { placeholder: 'Moderate' })}
              {field('netVolume', 'Net volume', { placeholder: '100ml' })}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sizes & stock</p>
              <button type="button" onClick={() => setForm((f) => ({ ...f, variants: [...f.variants, blankVariant()] }))} className="text-[10px] uppercase tracking-[0.18em] underline">
                Add size
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {form.variants.map((variant, index) => (
                <div key={variant.id || index} className="grid grid-cols-2 gap-2 border border-border bg-card p-3 sm:grid-cols-7">
                  <input value={variant.size} onChange={(e) => setVariant(index, 'size', e.target.value)} placeholder="50ml" className="field-luxe" />
                  <input value={variant.sku} onChange={(e) => setVariant(index, 'sku', e.target.value)} placeholder="SKU" className="field-luxe" />
                  <input value={variant.price} onChange={(e) => setVariant(index, 'price', e.target.value)} placeholder="Price" type="number" className="field-luxe" />
                  <input value={variant.salePrice ?? ''} onChange={(e) => setVariant(index, 'salePrice', e.target.value)} placeholder="Sale price" type="number" className="field-luxe" />
                  <input value={variant.stock} onChange={(e) => setVariant(index, 'stock', e.target.value)} placeholder="Stock" type="number" className="field-luxe" />
                  <input value={variant.lowStockThreshold} onChange={(e) => setVariant(index, 'lowStockThreshold', e.target.value)} placeholder="Low at" type="number" className="field-luxe" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }))}
                    className="text-[10px] uppercase tracking-[0.16em] text-destructive"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Each size carries its own SKU, price, sale price and stock.</p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Images</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {form.images.map((image) => (
                <div key={image} className="relative h-24 w-20 border border-border bg-card">
                  <img src={image} alt="Fragrance" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((i) => i !== image) }))}
                    className="absolute right-1 top-1 bg-card/90 p-0.5"
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="grid h-24 w-20 cursor-pointer place-items-center border border-dashed border-border text-[10px] uppercase tracking-[0.14em]">
                {uploading ? '…' : 'Upload'}
                <input type="file" accept="image/*" multiple onChange={uploadImages} className="hidden" />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Product images are stored publicly so they can appear on the storefront.</p>
          </section>

          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Batch & compliance</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {field('manufacturer', 'Manufacturer / marketer')}
              {field('countryOfOrigin', 'Country of origin')}
              <label className="block">
                <span className="label-luxe">Compliance review</span>
                <select value={form.complianceStatus} onChange={set('complianceStatus')} className="field-luxe">
                  <option value="pending">Pending review</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="approved">Approved for sale</option>
                </select>
              </label>
              {field('shippingClass', 'Shipping classification')}
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="label-luxe">Handling instructions</span>
                  <textarea rows={2} value={form.handlingInstructions} onChange={set('handlingInstructions')} className="field-luxe" />
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className="block">
                  <span className="label-luxe">Ingredients / composition</span>
                  <textarea rows={2} value={form.ingredients} onChange={set('ingredients')} className="field-luxe" />
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="label-luxe">Usage instructions</span>
                  <textarea rows={2} value={form.usage} onChange={set('usage')} className="field-luxe" />
                </label>
              </div>
              <div>
                <label className="block">
                  <span className="label-luxe">Storage & safety</span>
                  <textarea rows={2} value={form.storage} onChange={set('storage')} className="field-luxe" />
                </label>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {form.batches.map((batch, index) => (
                <div key={index} className="grid grid-cols-2 gap-2 border border-border bg-card p-3 sm:grid-cols-4">
                  <input value={batch.batchNumber || ''} onChange={(e) => setForm((f) => ({ ...f, batches: f.batches.map((b, i) => i === index ? { ...b, batchNumber: e.target.value } : b) }))} placeholder="Batch no." className="field-luxe" />
                  <input value={batch.manufacturingDate || ''} onChange={(e) => setForm((f) => ({ ...f, batches: f.batches.map((b, i) => i === index ? { ...b, manufacturingDate: e.target.value } : b) }))} type="date" className="field-luxe" />
                  <input value={batch.expiryDate || ''} onChange={(e) => setForm((f) => ({ ...f, batches: f.batches.map((b, i) => i === index ? { ...b, expiryDate: e.target.value } : b) }))} type="date" className="field-luxe" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, batches: f.batches.filter((_, i) => i !== index) }))} className="text-[10px] uppercase tracking-[0.16em] text-destructive">Remove batch</button>
                </div>
              ))}
              <button type="button" onClick={() => setForm((f) => ({ ...f, batches: [...f.batches, { batchNumber: '', manufacturingDate: '', expiryDate: '', quantity: 0 }] }))} className="text-[10px] uppercase tracking-[0.18em] underline">
                Add batch
              </button>
            </div>
          </section>

          {error ? <p className="border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</p> : null}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-card px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)} className="btn-luxe-ghost">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="btn-luxe">{saving ? 'Saving…' : 'Save fragrance'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}