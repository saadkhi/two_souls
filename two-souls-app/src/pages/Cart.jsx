import { Link } from 'react-router-dom';
import { Minus, Plus, X } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useCart } from '@/components/cart/CartContext';
import { useStorefront } from '@/lib/useStorefront';
import { formatMoney } from '@/lib/format';

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem, count } = useCart();
  const { settings } = useStorefront();
  const symbol = settings.currencySymbol;
  const threshold = Number(settings.freeShippingThreshold || 0);
  const remaining = Math.max(0, threshold - subtotal);

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-5 py-28 text-center">
        <p className="eyebrow">Your bag</p>
        <h1 className="mt-3 font-heading text-4xl">Nothing selected yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">Begin with a fragrance you keep returning to.</p>
        <Link to="/shop" className="btn-luxe mt-8">Explore the collection</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-12 lg:px-10 lg:py-16">
      <div className="flex items-baseline justify-between border-b border-border pb-6">
        <h1 className="font-heading text-4xl">Your bag</h1>
        <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{count} items</span>
      </div>

      <p className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {remaining > 0
          ? `Add ${formatMoney(remaining, symbol)} for complimentary delivery`
          : 'Complimentary delivery applied'}
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          {items.map((item) => (
            <div key={item.key} className="flex gap-4 border-b border-border py-6 sm:gap-6">
              <Link to={`/product/${item.slug}`} className="w-24 shrink-0 sm:w-32">
                <Image src={item.image} alt={item.name} className="aspect-[3/4] w-full" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={`/product/${item.slug}`} className="font-heading text-xl">{item.name}</Link>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {item.size} · {item.family}
                    </p>
                  </div>
                  <button type="button" aria-label="Remove item" onClick={() => removeItem(item.key)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <div className="flex items-center border border-border">
                    <button type="button" aria-label="Decrease" className="grid h-9 w-9 place-items-center" onClick={() => updateQuantity(item.key, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-xs tabular-nums">{item.quantity}</span>
                    <button type="button" aria-label="Increase" className="grid h-9 w-9 place-items-center" onClick={() => updateQuantity(item.key, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatMoney(item.price * item.quantity, symbol)}</p>
                    {item.quantity > 1 ? (
                      <p className="text-[10px] text-muted-foreground">{formatMoney(item.price, symbol)} each</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <Link to="/shop" className="link-underline mt-8 inline-block">Continue shopping</Link>
        </div>

        <aside className="h-fit border border-border bg-card p-6 lg:sticky lg:top-28">
          <p className="eyebrow">Summary</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatMoney(subtotal, symbol)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Delivery</dt>
              <dd>{subtotal >= threshold ? 'Complimentary' : 'Calculated at checkout'}</dd>
            </div>
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Estimated total</span>
            <span className="font-heading text-2xl">{formatMoney(subtotal, symbol)}</span>
          </div>
          <Link to="/checkout" className="btn-luxe mt-6 w-full">Checkout</Link>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Cash on delivery · Bank transfer
          </p>
        </aside>
      </div>
    </div>
  );
}