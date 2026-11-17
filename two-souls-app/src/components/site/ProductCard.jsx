import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { productFromPrice, productStock } from '@/lib/format';
import { formatMoney } from '@/lib/format';
import { useWishlist } from '@/lib/wishlist';

export default function ProductCard({ product, currencySymbol = 'Rs.' }) {
  const wishlist = useWishlist();
  const variants = product.variants || [];
  const cheapest = variants.reduce(
    (min, v) => {
      const price = Number(v.salePrice || v.price || 0);
      return !min || price < min.price ? { ...v, price } : min;
    },
    null
  );
  const price = productFromPrice(product);
  const compareAt = cheapest?.salePrice ? Number(cheapest.price) : null;
  const inStock = productStock(product) > 0;
  const liked = wishlist.has(product.id);

  return (
    <article className="group relative">
      <Link to={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <Image
            src={(product.images || [])[0]}
            alt={product.name}
            className="h-full w-full transition-transform ease-out group-hover:scale-[1.04]"
            style={{ transitionDuration: '1200ms' }}
          />
          {product.isNew ? (
            <span className="absolute left-3 top-3 bg-background/90 px-2.5 py-1 text-[9px] uppercase tracking-[0.24em]">
              New
            </span>
          ) : null}
          {!inStock ? (
            <span className="absolute inset-x-0 bottom-0 bg-foreground/80 py-2 text-center text-[9px] uppercase tracking-[0.24em] text-background">
              Sold out
            </span>
          ) : null}
        </div>
      </Link>

      <button
        type="button"
        aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
        onClick={() => wishlist.toggle(product.id)}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85 backdrop-blur transition-opacity hover:bg-background"
      >
        <Heart
          className="h-4 w-4 transition-colors"
          strokeWidth={1.25}
          fill={liked ? '#C5A77A' : 'none'}
        />
      </button>

      <div className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/product/${product.slug}`} className="font-heading text-lg leading-tight">
            {product.name}
          </Link>
          {product.rating ? (
            <span className="flex shrink-0 items-center gap-1 pt-1 text-[10px] text-muted-foreground">
              <Star className="h-3 w-3" fill="#C5A77A" stroke="none" />
              {Number(product.rating).toFixed(1)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {[product.family, product.concentration].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-2 flex items-baseline gap-2 text-sm">
          <span>{formatMoney(price, currencySymbol)}</span>
          {compareAt ? (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(compareAt, currencySymbol)}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {variants.length ? `${variants.length} sizes` : ''}
          </span>
        </div>
      </div>
    </article>
  );
}
