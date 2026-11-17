import { useState } from 'react';
import { storeApi } from '@/api/storeClient';
import { formatMoney } from '@/lib/format';

export default function NewsletterSection({ settings }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setStatus('sending');
    setError('');
    const existing = await storeApi.entities.NewsletterSubscriber.filter({ email: email.toLowerCase() });
    if (existing.length === 0) {
      await storeApi.entities.NewsletterSubscriber.create({
        email: email.toLowerCase(),
        source: 'storefront',
        active: true,
      });
    }
    setStatus('done');
    setEmail('');
  };

  return (
    <section className="bg-foreground text-background" style={{ backgroundColor: '#171717', color: '#F5F0E7' }}>
      <div className="mx-auto grid max-w-[1600px] gap-8 px-5 py-16 lg:grid-cols-2 lg:items-center lg:px-10 lg:py-24">
        <div>
          <p className="eyebrow" style={{ color: '#C5A77A' }}>The list</p>
          <h2 className="mt-3 font-heading text-3xl leading-tight sm:text-4xl lg:text-5xl">
            First access to new compositions
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-70">
            Launch notes, private offers and restock notices. No more than twice a month.
          </p>
        </div>

        <div>
          {status === 'done' ? (
            <p className="border-t border-white/20 pt-6 text-sm">
              Thank you — you are on the list. Look out for our next launch note.
            </p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="newsletter-email" className="mb-2 block text-[10px] uppercase tracking-[0.24em] opacity-60">
                  Email address
                </label>
                <input
                  id="newsletter-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="min-h-[48px] w-full border-b border-white/30 bg-transparent py-3 text-sm outline-none placeholder:text-white/40 focus:border-[#C5A77A]"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'sending'}
                className="min-h-[48px] border border-[#C5A77A] px-8 text-[11px] uppercase tracking-[0.26em] text-[#C5A77A] transition-colors hover:bg-[#C5A77A] hover:text-[#171717] disabled:opacity-50"
              >
                {status === 'sending' ? 'Joining…' : 'Subscribe'}
              </button>
            </form>
          )}
          {error ? <p className="mt-3 text-xs text-[#E8A9A0]">{error}</p> : null}
          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] opacity-40">
            Complimentary delivery above {formatMoney(settings.freeShippingThreshold, settings.currencySymbol)}
          </p>
        </div>
      </div>
    </section>
  );
}