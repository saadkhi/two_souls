import { Link } from 'react-router-dom';
import { Minus, Plus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Image } from '@/components/ui/image';
import { useCart } from '@/components/cart/CartContext';
import { formatMoney } from '@/lib/format';

export default function CartDrawer({ currencySymbol = 'Rs.', freeShippingThreshold = 5000 }) {
  const { items, isOpen, closeCart, updateQuantity, removeItem, subtotal, count } = useCart();
  const remaining = Math.max(0, Number(freeShippingThreshold) - subtotal);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (open ? null : closeCart())}>
      <SheetContent side="right" className="flex w-full max-w-md flex-col border-l border-border bg-background p-0">
        <SheetTitle className="sr-only">Shopping bag</SheetTitle>
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.28em]">Your bag ({count})</p>
          <button type="button" aria-label="Close bag" onClick={closeCart}>
            <X className="h-5 w-5" strokeWidth={1.25} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="font-heading text-2xl">Your bag is empty</p>
            <p className="text-sm text-muted-foreground">
              Begin with a fragrance you keep returning to.
            </p>
            <Link to="/shop" onClick={closeCart} className="btn-luxe mt-2">
              Explore the collection
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6">
              <p className="border-b border-border/70 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {remaining > 0
                  ? `Add ${formatMoney(remaining, currencySymbol)} for complimentary delivery`
                  : 'Complimentary delivery applied'}
              </p>
              {items.map((item) => (
                <div key={item.key} className="flex gap-4 border-b border-border/60 py-5">
                  <Link to={`/product/${item.slug}`} onClick={closeCart} className="w-20 shrink-0">
                    <Image src={item.image} alt={item.name} className="aspect-[3/4] w-full" />
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-heading text-base leading-tight">{item.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {item.size}
                        </p>
                      </div>
                      <button type="button" aria-label="Remove" onClick={() => removeItem(item.key)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center border border-border">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          className="grid h-8 w-8 place-items-center"
                          onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                        <span className="w-7 text-center text-xs tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="grid h-8 w-8 place-items-center"
                          onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.5} />
                        </button>
                      </div>
                      <span className="text-sm">{formatMoney(item.price * item.quantity, currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Subtotal</span>
                <span className="font-heading text-xl">{formatMoney(subtotal, currencySymbol)}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Delivery and any discounts calculated at checkout.</p>
              <Link to="/cart" onClick={closeCart} className="btn-luxe mt-4 w-full">
                View bag
              </Link>
              <Link to="/checkout" onClick={closeCart} className="btn-luxe-ghost mt-2 w-full">
                Checkout
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}