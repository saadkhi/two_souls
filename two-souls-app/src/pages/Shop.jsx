import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { useStorefront } from '@/lib/useStorefront';
import ProductCard from '@/components/site/ProductCard';
import { Image } from '@/components/ui/image';
import { formatMoney, productFromPrice, productStock, PROVINCES } from '@/lib/format';

const PAGE_SIZE = 12;

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price · low to high' },
  { value: 'price-desc', label: 'Price · high to low' },
  { value: 'bestselling', label: 'Bestselling' },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const { settings, collections } = useStorefront();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceMax, setPriceMax] = useState('');
  const [size, setSize] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('featured');

  const q = params.get('q') || '';
  const gender = params.get('gender') || '';
  const family = params.get('family') || '';
  const concentration = params.get('concentration') || '';
  const collectionSlug = params.get('collection') || '';
  const quick = params.get('filter') || '';

  const collectionName = useMemo(() => {
    if (!collectionSlug) return '';
    return collections.find((c) => c.slug === collectionSlug)?.name || '';
  }, [collectionSlug, collections]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const query = { status: 'active' };
    if (gender) query.gender = gender;
    if (family) query.family = family;
    if (concentration) query.concentration = concentration;
    if (collectionName) query.collection = collectionName;
    if (q) query.name = { $regex: q, $options: 'i' };

    storeApi.entities.Product
      .filter(query, { limit: 200 })
      .then((result) => {
        if (!alive) return;
        setProducts(result.items || []);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [gender, family, concentration, collectionName, q]);

  useEffect(() => {
    setPage(1);
  }, [gender, family, concentration, collectionName, q, priceMax, size, inStockOnly, sort]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (quick === 'new') list = list.filter((p) => p.isNew);
    if (quick === 'bestsellers') list = list.filter((p) => p.bestseller);
    if (priceMax) list = list.filter((p) => productFromPrice(p) <= Number(priceMax));
    if (size) list = list.filter((p) => (p.variants || []).some((v) => v.size === size && Number(v.stock) > 0));
    if (inStockOnly) list = list.filter((p) => productStock(p) > 0);

    if (sort === 'price-asc') list.sort((a, b) => productFromPrice(a) - productFromPrice(b));
    if (sort === 'price-desc') list.sort((a, b) => productFromPrice(b) - productFromPrice(a));
    if (sort === 'bestselling') list.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));
    return list;
  }, [products, quick, priceMax, size, inStockOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const heading = quick === 'bestsellers'
    ? 'Best Sellers'
    : quick === 'new'
      ? 'New Arrivals'
      : gender
        ? `${gender} Fragrances`
        : collectionName || 'Shop All';

  if (params.get('view') === 'collections') {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-10">
        <p className="eyebrow">Collections</p>
        <h1 className="mt-3 font-heading text-4xl sm:text-5xl">The collections</h1>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link key={collection.slug} to={`/shop?collection=${collection.slug}`} className="group">
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                <Image src={collection.image} alt={collection.name} className="h-full w-full transition-transform duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-0 p-5">
                  <p className="font-heading text-2xl text-white">{collection.name}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/70">{collection.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-5 py-12 lg:px-10 lg:py-16">
      <div className="flex flex-col gap-2 border-b border-border pb-8">
        <p className="eyebrow">{filtered.length} fragrances</p>
        <h1 className="font-heading text-4xl sm:text-5xl">{heading}</h1>
        {q ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Results for “{q}”{' '}
            <button type="button" onClick={() => setParam('q', '')} className="underline">
              clear
            </button>
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((s) => !s)}
          className="flex items-center gap-2 border border-border px-4 py-2.5 text-[10px] uppercase tracking-[0.22em]"
        >
          {filtersOpen ? <X className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
          Filters
        </button>
        <div className="flex items-center gap-3">
          <label htmlFor="sort" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border-b border-border bg-transparent py-2 text-xs outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtersOpen ? (
        <div className="mt-6 grid gap-6 border border-border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="label-luxe">Gender</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {['', 'Men', 'Women', 'Unisex'].map((g) => (
                <button
                  key={g || 'all'}
                  type="button"
                  onClick={() => setParam('gender', g)}
                  className={`border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] ${gender === g ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
                >
                  {g || 'All'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label-luxe">Collection</p>
            <select
              value={collectionSlug}
              onChange={(e) => setParam('collection', e.target.value)}
              className="field-luxe mt-1"
            >
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="label-luxe">Fragrance family</p>
            <select value={family} onChange={(e) => setParam('family', e.target.value)} className="field-luxe mt-1">
              <option value="">Any family</option>
              {['Woody', 'Oud', 'Amber', 'Floral', 'Fresh', 'Citrus', 'Aquatic', 'Oriental', 'Aromatic', 'Gourmand', 'Spicy', 'Musky'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="label-luxe">Concentration</p>
            <select value={concentration} onChange={(e) => setParam('concentration', e.target.value)} className="field-luxe mt-1">
              <option value="">Any concentration</option>
              {['Eau de Parfum', 'Eau de Toilette', 'Extrait de Parfum', 'Parfum'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="label-luxe">Max price</p>
            <input
              type="number"
              inputMode="numeric"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder={`Up to ${formatMoney(20000, settings.currencySymbol)}`}
              className="field-luxe mt-1"
            />
          </div>
          <div>
            <p className="label-luxe">Size</p>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="field-luxe mt-1">
              <option value="">Any size</option>
              {['10ml', '20ml', '30ml', '50ml', '100ml'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              In stock only
            </label>
          </div>
          <div className="flex items-end">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Delivers across {PROVINCES.length} regions
            </span>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 py-12 lg:grid-cols-4 lg:gap-x-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-muted" />
              <div className="mt-4 h-3 w-2/3 bg-muted" />
              <div className="mt-2 h-3 w-1/3 bg-muted" />
            </div>
          ))}
        </div>
      ) : visible.length ? (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} currencySymbol={settings.currencySymbol} />
            ))}
          </div>
          {pageCount > 1 ? (
            <div className="mt-14 flex items-center justify-center gap-2">
              {Array.from({ length: pageCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPage(i + 1)}
                  className={`h-9 w-9 border text-xs ${page === i + 1 ? 'border-foreground bg-foreground text-background' : 'border-border'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="py-24 text-center">
          <p className="font-heading text-2xl">No fragrances match those filters</p>
          <p className="mt-2 text-sm text-muted-foreground">Try widening the family or clearing the price limit.</p>
          <button
            type="button"
            onClick={() => {
              setParams(new URLSearchParams(), { replace: true });
              setPriceMax('');
              setSize('');
              setInStockOnly(false);
            }}
            className="btn-luxe-ghost mt-6"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}