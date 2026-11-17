import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function CollectionStrip({ collections }) {
  if (!collections?.length) return null;

  return (
    <section className="mx-auto max-w-[1600px] px-5 py-16 lg:px-10 lg:py-24">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow">Collections</p>
          <h2 className="mt-3 font-heading text-3xl sm:text-4xl lg:text-5xl">Explore by character</h2>
        </div>
        <Link to="/shop?view=collections" className="link-underline hidden shrink-0 pb-1 sm:block">
          All collections
        </Link>
      </div>

      <div className="mt-10 -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0">
        {collections.slice(0, 4).map((collection) => (
          <Link
            key={collection.slug || collection.id}
            to={`/shop?collection=${encodeURIComponent(collection.slug)}`}
            className="group relative w-[76vw] shrink-0 snap-start sm:w-[44vw] lg:w-auto"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <Image
                src={collection.image}
                alt={collection.name}
                className="h-full w-full transition-transform ease-out group-hover:scale-105"
                style={{ transitionDuration: '1400ms' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-heading text-2xl text-white">{collection.name}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
                  {collection.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
