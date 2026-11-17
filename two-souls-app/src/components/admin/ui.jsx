import { formatMoney } from '@/lib/format';

export function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={`mt-2 font-heading text-2xl ${tone === 'accent' ? 'text-accent' : ''}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Money({ value }) {
  return <span className="tabular-nums">{formatMoney(value)}</span>;
}

const TONES = {
  green: 'bg-green-50 text-green-800 border-green-200',
  yellow: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  blue: 'bg-blue-50 text-blue-800 border-blue-200',
  gray: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  purple: 'bg-purple-50 text-purple-800 border-purple-200',
};

export function Pill({ tone = 'gray', children }) {
  return (
    <span className={`inline-flex whitespace-nowrap border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${TONES[tone] || TONES.gray}`}>
      {children}
    </span>
  );
}

export function statusTone(value) {
  if (['paid', 'delivered', 'approved', 'reconciled', 'active'].includes(value)) return 'green';
  if (['cancelled', 'failed', 'rejected', 'delivery_failed', 'returned', 'restricted', 'refunded'].includes(value)) return 'red';
  if (['unpaid', 'pending', 'awaiting_verification', 'draft'].includes(value)) return 'yellow';
  if (['in_transit', 'out_for_delivery', 'picked_up', 'courier_booked', 'processing', 'packed', 'confirmed'].includes(value)) return 'blue';
  return 'gray';
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(typeof row[h] === 'object' ? JSON.stringify(row[h]) : row[h])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminHeading({ eyebrow, title, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="mt-1 font-heading text-3xl">{title}</h1>
      </div>
      {action}
    </div>
  );
}