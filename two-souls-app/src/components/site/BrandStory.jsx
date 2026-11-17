import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function BrandStory({ story }) {
  if (!story) return null;

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-[1600px] items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-24">
        <div className="relative order-1 aspect-[4/5] overflow-hidden bg-muted lg:aspect-[4/3]">
          <Image src={story.image} alt={story.title} className="h-full w-full" />
          <span className="absolute left-4 top-4 text-[9px] uppercase tracking-[0.28em] text-white/70">
            The atelier
          </span>
        </div>
        <div className="order-2">
          <p className="eyebrow">{story.eyebrow}</p>
          <h2 className="mt-4 whitespace-pre-line font-heading text-3xl leading-tight sm:text-4xl lg:text-5xl">
            {story.title}
          </h2>
          <p className="mt-6 max-w-lg text-sm leading-relaxed text-muted-foreground">{story.body}</p>
          <Link to={story.ctaLink || '/about'} className="link-underline mt-8 inline-block border-b border-foreground/40 pb-1">
            {story.ctaLabel || 'Read our story'}
          </Link>
        </div>
      </div>
    </section>
  );
}