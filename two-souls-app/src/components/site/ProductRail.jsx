import { Link } from 'react-router-dom';
import ProductCard from '@/components/site/ProductCard';

export default function ProductRail({
  eyebrow,
  title,
  products = [],
  ctaHref = '/shop',
  ctaLabel = 'View all',
  currencySymbol = 'Rs.',
}) {
  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-[1600px] px-5 py-16 lg:px-10 lg:py-20">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl lg:text-5xl">{title}</h2>
        </div>
        <Link to={ctaHref} className="link-underline hidden shrink-0 pb-1 sm:block">
          {ctaLabel}
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 lg:gap-x-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} currencySymbol={currencySymbol} />
        ))}
      </div>

      <div className="mt-10 sm:hidden">
        <Link to={ctaHref} className="btn-luxe-ghost w-full">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}