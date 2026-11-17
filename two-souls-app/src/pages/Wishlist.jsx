import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeApi } from '@/api/storeClient';
import { useWishlist } from '@/lib/wishlist';
import { useStorefront } from '@/lib/useStorefront';
import ProductCard from '@/components/site/ProductCard';

export default function Wishlist() {
  const wishlist = useWishlist();
  const { settings } = useStorefront();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (!wishlist.ids.length) {
      setProducts([]);
      return;
    }
    storeApi.entities.Product.filter({ id: { $in: wishlist.ids } }, { limit: 100 }).then((res) =>
      setProducts(res.items || [])
    );
  }, [wishlist.ids]);

  const visible = useMemo(() => products.filter((p) => wishlist.ids.includes(p.id)), [products, wishlist.ids]);

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-10 lg:py-20">
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="eyebrow">Saved</p>
          <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Your wishlist</h1>
        </div>
        {visible.length ? (
          <button type="button" onClick={wishlist.clear} className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground underline">
            Clear
          </button>
        ) : null}
      </div>

      {visible.length ? (
        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} currencySymbol={settings.currencySymbol} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <p className="font-heading text-2xl">Nothing saved yet</p>
          <p className="mt-2 text-sm text-muted-foreground">Tap the heart on any fragrance to keep it here.</p>
          <Link to="/shop" className="btn-luxe mt-8">Explore the collection</Link>
        </div>
      )}
    </div>
  );
}