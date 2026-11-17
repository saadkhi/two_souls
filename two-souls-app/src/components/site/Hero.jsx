import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function Hero({ hero }) {
  if (!hero) return null;

  return (
    <section className="border-b border-border">
      <div className="grid min-h-[86vh] lg:grid-cols-2">
        <div className="order-2 flex flex-col justify-center px-6 py-14 sm:px-12 lg:order-1 lg:px-16 lg:py-24 xl:px-24">
          <p className="eyebrow animate-rise">{hero.eyebrow}</p>
          <h1 className="mt-6 whitespace-pre-line font-heading text-[15vw] leading-[0.9] animate-rise sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
            {hero.headline}
          </h1>
          <p className="mt-7 max-w-md text-sm leading-relaxed text-muted-foreground animate-fade">
            {hero.subheadline}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to={hero.ctaPrimaryLink || '/shop'} className="btn-luxe">
              {hero.ctaPrimaryLabel}
            </Link>
            <Link to={hero.ctaSecondaryLink || '/shop?filter=bestsellers'} className="btn-luxe-ghost">
              {hero.ctaSecondaryLabel}
            </Link>
          </div>
          <dl className="mt-14 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-6 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <div>
              <dt className="sr-only">Currency</dt>
              <dd>Prices in PKR</dd>
            </div>
            <div>
              <dt className="sr-only">Delivery</dt>
              <dd>Nationwide delivery</dd>
            </div>
            <div>
              <dt className="sr-only">Payment</dt>
              <dd>Cash on delivery</dd>
            </div>
          </dl>
        </div>

        <div className="relative order-1 overflow-hidden bg-muted lg:order-2">
          {hero.desktopImage ? (
            <Image
              src={hero.desktopImage}
              alt="Signature fragrance editorial"
              className="hidden h-full w-full lg:block"
            />
          ) : null}
          {hero.mobileImage || hero.desktopImage ? (
            <Image
              src={hero.mobileImage || hero.desktopImage}
              alt="Signature fragrance editorial"
              className="aspect-[4/5] h-full w-full lg:hidden"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}