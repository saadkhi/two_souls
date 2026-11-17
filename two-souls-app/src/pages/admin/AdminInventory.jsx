import { useEffect, useMemo, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill } from '@/components/admin/ui';
import { formatDateTime } from '@/lib/format';

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [adjust, setAdjust] = useState(null);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [productPage, logPage] = await Promise.all([
      storeApi.entities.Product.filter({}, { sort: 'name', limit: 200 }),
      storeApi.entities.InventoryLog.filter({}, { sort: '-created_date', limit: 100 }),
    ]);
    setProducts(productPage.items || []);
    setLogs(logPage.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(
    () =>
      products.flatMap((product) =>
        (product.variants || []).map((variant) => ({
          productId: product.id,
          productName: product.name,
          sku: variant.sku,
          size: variant.size,
          stock: Number(variant.stock) || 0,
          threshold: Number(variant.lowStockThreshold ?? 5),
          batch: (product.batches || [])[0]?.batchNumber || '—',
          expiry: (product.batches || [])[0]?.expiryDate || '',
        }))
      ),
    [products]
  );

  const saveAdjustment = async () => {
    if (!adjust) return;
    setSaving(true);
    const product = products.find((p) => p.id === adjust.productId);
    const delta = Number(amount) || 0;
    const variants = (product.variants || []).map((v) =>
      v.sku === adjust.sku ? { ...v, stock: Math.max(0, (Number(v.stock) || 0) + delta) } : v
    );
    await storeApi.entities.Product.update(product.id, { variants });
    const balance = variants.find((v) => v.sku === adjust.sku)?.stock || 0;
    await storeApi.entities.InventoryLog.create({
      productId: product.id,
      productName: product.name,
      variantSku: adjust.sku,
      variantSize: adjust.size,
      type: delta >= 0 ? 'restock' : 'adjustment',
      quantityChange: delta,
      balanceAfter: balance,
      reason: reason || 'Manual adjustment',
      actor: (await storeApi.auth.me()).email,
    });
    setSaving(false);
    setAdjust(null);
    setAmount(1);
    setReason('');
    load();
  };

  return (
    <div>
      <AdminHeading eyebrow="Stock" title="Inventory" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fragrance</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">Adjust</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.productId}-${row.sku}`} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-heading text-base">{row.productName}</p>
                    <p className="text-[10px] text-muted-foreground">{row.sku}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.size}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.batch}
                    {row.expiry ? <span className="block text-muted-foreground">Exp {row.expiry}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={row.stock <= 0 ? 'red' : row.stock <= row.threshold ? 'yellow' : 'green'}>
                      {row.stock} units
                    </Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setAdjust(row)}
                      className="text-[10px] uppercase tracking-[0.16em] underline"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No stock records yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div>
          {adjust ? (
            <div className="mb-4 border border-border bg-card p-5">
              <p className="font-heading text-lg">{adjust.productName} · {adjust.size}</p>
              <p className="text-[11px] text-muted-foreground">Current stock: {adjust.stock}</p>
              <label className="label-luxe mt-4">Change (+ restock, − reduction)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="field-luxe" />
              <label className="label-luxe mt-3">Reason</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stock received, damage, correction…" className="field-luxe" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={saveAdjustment} disabled={saving} className="btn-luxe">
                  {saving ? 'Saving…' : 'Apply'}
                </button>
                <button type="button" onClick={() => setAdjust(null)} className="btn-luxe-ghost">Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="border border-border bg-card p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Stock movement</p>
            <ul className="mt-3 max-h-[520px] space-y-2 overflow-y-auto text-xs">
              {logs.map((log) => (
                <li key={log.id} className="border-b border-border/60 pb-2">
                  <div className="flex justify-between gap-3">
                    <span>{log.productName} · {log.variantSize}</span>
                    <span className={log.quantityChange >= 0 ? 'text-green-700' : 'text-red-700'}>
                      {log.quantityChange >= 0 ? '+' : ''}{log.quantityChange}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {log.type} · {log.reason} {log.reference ? `· ${log.reference}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(log.created_date)}</p>
                </li>
              ))}
              {logs.length === 0 ? <li className="text-muted-foreground">No movements recorded yet.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
