import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Heart, Minus, Plus, Star, Truck } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { Image } from '@/components/ui/image';
import { useCart } from '@/components/cart/CartContext';
import { useStorefront } from '@/lib/useStorefront';
import { useWishlist } from '@/lib/wishlist';
import ProductCard from '@/components/site/ProductCard';
import { formatMoney } from '@/lib/format';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { settings } = useStorefront();
  const cart = useCart();
  const wishlist = useWishlist();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [variantSku, setVariantSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    storeApi.entities.Product.filter({ slug, status: 'active' }).then((rows) => {
      if (!alive) return;
      const found = rows[0] || null;
      setProduct(found);
      setLoading(false);
      if (found) {
        const options = (found.variants || []).filter((v) => v.active !== false);
        const preferred = options.find((v) => Number(v.stock) > 0) || options[0];
        setVariantSku(preferred?.sku || '');
        storeApi.entities.Review.filter({ productId: found.id, status: 'approved' }).then((r) => alive && setReviews(r));
        storeApi.entities.Product.filter({ collection: found.collection, status: 'active' }, { limit: 8 }).then((res) => {
          if (alive) setRelated((res.items || []).filter((p) => p.id !== found.id).slice(0, 4));
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  const variants = useMemo(() => product?.variants || [], [product]);
  const variant = variants.find((v) => v.sku === variantSku);
  const price = Number(variant?.salePrice || variant?.price || 0);
  const compareAt = variant?.salePrice ? Number(variant.price) : null;
  const stock = Number(variant?.stock || 0);
  const symbol = settings.currencySymbol;

  if (loading) {
    return <div className="mx-auto max-w-[1600px] px-5 py-24 lg:px-10"><div className="h-80 animate-pulse bg-muted" /></div>;
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-xl px-5 py-32 text-center">
        <h1 className="font-heading text-3xl">This fragrance is no longer listed</h1>
        <Link to="/shop" className="btn-luxe mt-8">Browse the collection</Link>
      </div>
    );
  }

  const addToBag = () => {
    if (!variant || stock < 1) return;
    cart.addItem(product, variant, quantity);
  };

  const buyNow = () => {
    if (!variant || stock < 1) return;
    cart.addItem(product, variant, quantity);
    navigate('/checkout');
  };

  const notes = [
    { label: 'Top notes', items: product.topNotes },
    { label: 'Heart notes', items: product.heartNotes },
    { label: 'Base notes', items: product.baseNotes },
  ].filter((n) => n.items?.length);

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-10 lg:px-10 lg:py-14">
      <nav className="mb-8 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/">Home</Link><span>/</span>
        <Link to="/shop">Shop</Link><span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <div className="relative aspect-[3/4] overflow-hidden bg-muted">
            <Image
              src={(product.images || [])[activeImage]}
              alt={product.name}
              className="h-full w-full transition-transform duration-700 hover:scale-105"
              fittingType="fill"
            />
            {product.isNew ? (
              <span className="absolute left-4 top-4 bg-background/90 px-3 py-1 text-[9px] uppercase tracking-[0.24em]">New</span>
            ) : null}
          </div>
          {(product.images || []).length > 1 ? (
            <div className="mt-3 flex gap-3">
              {product.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`w-20 border ${index === activeImage ? 'border-foreground' : 'border-transparent'}`}
                >
                  <Image src={image} alt={`${product.name} view ${index + 1}`} className="aspect-[3/4] w-full" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          {settings.logoUrl ? (
            <Image
              src={settings.logoUrl}
              alt={`${settings.brandName || 'Two Souls'} seal`}
              fittingType="fit"
              className="mb-5 h-16 w-16 rounded-full ring-1 ring-accent/50"
            />
          ) : null}
          <p className="eyebrow">{[product.collection, product.family].filter(Boolean).join(' · ')}</p>
          <h1 className="mt-3 font-heading text-4xl leading-tight sm:text-5xl">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            {product.rating ? (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" fill="#C5A77A" stroke="none" />
                {Number(product.rating).toFixed(1)} · {product.reviewCount || reviews.length} reviews
              </span>
            ) : null}
            <span>{product.concentration}</span>
          </div>

          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">{product.description}</p>

          <div className="mt-7 flex items-baseline gap-3">
            <span className="font-heading text-3xl">{formatMoney(price, symbol)}</span>
            {compareAt ? (
              <span className="text-sm text-muted-foreground line-through">{formatMoney(compareAt, symbol)}</span>
            ) : null}
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {stock > 0 ? `${stock} in stock` : 'Sold out'}
            </span>
          </div>

          <div className="mt-7">
            <p className="label-luxe">Size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {variants.map((v) => {
                const disabled = Number(v.stock) < 1;
                return (
                  <button
                    key={v.sku}
                    type="button"
                    disabled={disabled}
                    onClick={() => setVariantSku(v.sku)}
                    className={`min-h-[44px] min-w-[74px] border px-4 text-xs tracking-wide transition-colors ${
                      variantSku === v.sku ? 'border-foreground bg-foreground text-background' : 'border-border hover:border-foreground'
                    } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-border' : ''}`}
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-border">
              <button type="button" aria-label="Decrease" className="grid h-11 w-11 place-items-center" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
              <button type="button" aria-label="Increase" className="grid h-11 w-11 place-items-center" onClick={() => setQuantity((q) => Math.min(stock || 1, q + 1))}>
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button type="button" onClick={addToBag} disabled={stock < 1} className="btn-luxe flex-1 disabled:opacity-40">
              {stock > 0 ? 'Add to bag' : 'Sold out'}
            </button>
            <button
              type="button"
              aria-label="Wishlist"
              onClick={() => wishlist.toggle(product.id)}
              className="grid h-12 w-12 place-items-center border border-border"
            >
              <Heart className="h-4 w-4" fill={wishlist.has(product.id) ? '#C5A77A' : 'none'} />
            </button>
          </div>
          {stock > 0 ? (
            <button type="button" onClick={buyNow} className="btn-luxe-ghost mt-3 w-full">
              Buy now
            </button>
          ) : null}

          <div className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
            <Truck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.4} />
            <p>
              Dispatched from {settings.dispatchCity || 'Lahore'} within one working day. Complimentary delivery above{' '}
              {formatMoney(settings.freeShippingThreshold, symbol)}. Cash on delivery available in serviced cities.
            </p>
          </div>

          {notes.length ? (
            <div className="mt-8 border-t border-border pt-6">
              <p className="eyebrow">The composition</p>
              <div className="mt-4 space-y-4">
                {notes.map((group, index) => (
                  <div key={group.label} className="flex gap-4">
                    <span className="w-6 shrink-0 font-heading text-lg text-accent">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{group.label}</p>
                      <p className="mt-1 text-sm">{group.items.join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 text-xs">
            {[
              ['Longevity', product.longevity],
              ['Sillage', product.sillage],
              ['Concentration', product.concentration],
              ['Country of origin', product.countryOfOrigin],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
                <dd className="mt-1">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 space-y-4 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
            {[['How to wear', product.usage], ['Storage', product.storage], ['Ingredients', product.ingredients], ['Safety', product.safetyWarnings]].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground">{label}</p>
                <p className="mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {reviews.length ? (
        <section className="mt-20 border-t border-border pt-10">
          <p className="eyebrow">Reviews</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {reviews.slice(0, 3).map((review) => (
              <figure key={review.id} className="border border-border bg-card p-5">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3" fill={i < (review.rating || 0) ? '#C5A77A' : 'none'} stroke="#C5A77A" />
                  ))}
                </div>
                {review.title ? <p className="mt-3 font-heading text-lg">{review.title}</p> : null}
                <p className="mt-2 text-sm text-muted-foreground">{review.body}</p>
                <figcaption className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{review.customerName}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-20">
          <div className="flex items-end justify-between">
            <h2 className="font-heading text-3xl">You may also like</h2>
            <Link to={`/shop?collection=${encodeURIComponent(product.collection || '')}`} className="link-underline hidden sm:block">
              More from this collection
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} currencySymbol={symbol} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
