export default function Benefits({ benefits = [] }) {
  if (!benefits.length) return null;

  return (
    <section className="mx-auto max-w-[1600px] px-5 py-16 lg:px-10 lg:py-20">
      <p className="eyebrow text-center">Why the house</p>
      <h2 className="mx-auto mt-3 max-w-2xl text-center font-heading text-3xl sm:text-4xl lg:text-5xl">
        Considered from first note to final bottle
      </h2>
      <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.slice(0, 4).map((benefit, index) => (
          <div key={benefit.title} className="border-t border-border pt-5">
            <span className="font-heading text-lg text-accent">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="mt-3 font-heading text-xl">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{benefit.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}