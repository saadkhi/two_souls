import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, statusTone } from '@/components/admin/ui';
import ProductForm from '@/components/admin/ProductForm';
import { formatMoney, productStock } from '@/lib/format';

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [productPage, collectionPage] = await Promise.all([
      storeApi.entities.Product.filter({}, { sort: '-created_date', limit: 200 }),
      storeApi.entities.Collection.filter({}, { limit: 50 }),
    ]);
    setProducts(productPage.items || []);
    setCollections(collectionPage.items || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchSearch = !search || `${p.name} ${p.sku} ${p.family}`.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !status || p.status === status;
        return matchSearch && matchStatus;
      }),
    [products, search, status]
  );

  const duplicate = async (product) => {
    const copy = { ...product };
    delete copy.id;
    delete copy.created_date;
    delete copy.updated_date;
    delete copy.created_by_id;
    await storeApi.entities.Product.create({
      ...copy,
      name: `${product.name} (copy)`,
      slug: `${product.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      status: 'draft',
      isNew: false,
      bestseller: false,
      featured: false,
    });
    load();
  };

  const toggleStatus = async (product) => {
    await storeApi.entities.Product.update(product.id, {
      status: product.status === 'active' ? 'draft' : 'active',
    });
    load();
  };

  const remove = async (product) => {
    await storeApi.entities.Product.delete(product.id);
    load();
  };

  return (
    <div>
      <AdminHeading
        eyebrow="Catalogue"
        title="Fragrances"
        action={
          <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="btn-luxe">
            Add fragrance
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU or family"
          className="min-h-[42px] w-full max-w-xs border border-border bg-card px-3 text-sm outline-none"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-[42px] border border-border bg-card px-3 text-xs">
          <option value="">All statuses</option>
          <option value="active">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading catalogue…</p> : (
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fragrance</th>
                <th className="px-4 py-3">Family</th>
                <th className="px-4 py-3">Sizes</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Compliance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="h-12 w-10 object-cover" />
                      ) : <div className="h-12 w-10 bg-muted" />}
                      <div>
                        <p className="font-heading text-base">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">{product.collection}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{product.family}<br /><span className="text-muted-foreground">{product.gender}</span></td>
                  <td className="px-4 py-3 text-xs">
                    {(product.variants || []).map((v) => (
                      <span key={v.sku} className="mr-2 whitespace-nowrap">
                        {v.size} · {formatMoney(v.salePrice || v.price)}
                      </span>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={productStock(product) <= 0 ? 'red' : productStock(product) <= 10 ? 'yellow' : 'green'}>
                      {productStock(product)} units
                    </Pill>
                  </td>
                  <td className="px-4 py-3"><Pill tone={statusTone(product.status)}>{product.status}</Pill></td>
                  <td className="px-4 py-3"><Pill tone={statusTone(product.complianceStatus)}>{product.complianceStatus}</Pill></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-3 text-[10px] uppercase tracking-[0.14em]">
                      <button type="button" onClick={() => { setEditing(product); setOpen(true); }} className="underline">Edit</button>
                      <button type="button" onClick={() => duplicate(product)} className="underline">Duplicate</button>
                      <button type="button" onClick={() => toggleStatus(product)} className="underline">
                        {product.status === 'active' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" onClick={() => remove(product)} className="underline text-destructive">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No fragrances match this view.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ProductForm
          open={open}
          onOpenChange={setOpen}
          product={editing}
          collections={collections}
          onSaved={load}
        />
      ) : null}
    </div>
  );
}