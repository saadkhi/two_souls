import { useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { AdminHeading, Pill, statusTone } from '@/components/admin/ui';
import { formatDate } from '@/lib/format';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('pending');

  const load = async () => {
    const rows = await storeApi.entities.Review.filter({}, { sort: '-created_date', limit: 200 });
    setReviews(rows.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (review, patch) => {
    await storeApi.entities.Review.update(review.id, patch);
    load();
  };

  const remove = async (review) => {
    await storeApi.entities.Review.delete(review.id);
    load();
  };

  const visible = reviews.filter((r) => filter === 'all' || r.status === filter);

  return (
    <div>
      <AdminHeading eyebrow="Social proof" title="Reviews" />

      <div className="mb-4 flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected', 'all'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`border px-3 py-2 text-[10px] uppercase tracking-[0.16em] ${filter === key ? 'border-accent bg-accent text-[#0F0E0D]' : 'border-border bg-card'}`}
          >
            {key} ({key === 'all' ? reviews.length : reviews.filter((r) => r.status === key).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((review) => (
          <div key={review.id} className="border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-lg">{review.title || 'Untitled review'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {review.customerName} · {review.productName || review.productId} · {formatDate(review.created_date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={statusTone(review.status)}>{review.status}</Pill>
                <Pill tone="gray">{review.rating}/5</Pill>
                {review.featured ? <Pill tone="blue">Featured</Pill> : null}
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{review.body}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.16em]">
              {review.status !== 'approved' ? (
                <button type="button" onClick={() => update(review, { status: 'approved' })} className="underline">Approve</button>
              ) : null}
              {review.status !== 'rejected' ? (
                <button type="button" onClick={() => update(review, { status: 'rejected' })} className="underline">Reject</button>
              ) : null}
              <button type="button" onClick={() => update(review, { featured: !review.featured })} className="underline">
                {review.featured ? 'Unfeature' : 'Feature'}
              </button>
              <button type="button" onClick={() => remove(review)} className="underline text-destructive">Delete</button>
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nothing to review here.</p>
        ) : null}
      </div>
    </div>
  );
}