import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { useStorefront } from '@/lib/useStorefront';

export default function About() {
  const { content, settings } = useStorefront();
  const story = content.brandStory || {};

  return (
    <div>
      <section className="mx-auto max-w-[1600px] px-5 py-14 lg:px-10 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">{story.eyebrow || 'The House'}</p>
            <h1 className="mt-4 font-heading text-4xl leading-tight sm:text-5xl lg:text-6xl">{story.title}</h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">{story.body}</p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{content.aboutBody}</p>
          </div>
          <div className="aspect-[4/5] overflow-hidden bg-muted">
            <Image src={story.image} alt={story.title || 'The atelier'} className="h-full w-full" />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-16 lg:grid-cols-3 lg:px-10">
          {(content.benefits || []).slice(0, 3).map((benefit, index) => (
            <div key={benefit.title}>
              <span className="font-heading text-lg text-accent">{String(index + 1).padStart(2, '0')}</span>
              <h2 className="mt-3 font-heading text-2xl">{benefit.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-5 py-16 lg:px-10">
        <div className="grid gap-8 border border-border p-8 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Dispatch</p>
            <p className="mt-2 text-sm">{settings.dispatchCity}, Pakistan</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Client care</p>
            <p className="mt-2 text-sm">{settings.supportEmail}</p>
            <p className="text-sm">{settings.contactPhone}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Start here</p>
            <Link to="/shop" className="link-underline mt-2 inline-block">Explore the collection</Link>
          </div>
        </div>
      </section>
    </div>
  );
}