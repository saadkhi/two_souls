import { useSearchParams } from 'react-router-dom';
import { useStorefront } from '@/lib/useStorefront';
import { formatDate } from '@/lib/format';

const SECTIONS = [
  { key: 'shipping', label: 'Shipping' },
  { key: 'returns', label: 'Returns & Exchanges' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'terms', label: 'Terms' },
];

export default function Policies() {
  const [params, setParams] = useSearchParams();
  const { content, settings } = useStorefront();
  const active = params.get('section') || 'shipping';
  const policies = content.policies || {};

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-14 lg:px-10 lg:py-20">
      <p className="eyebrow">Client care</p>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Policies</h1>

      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setParams({ section: section.key })}
            className={`px-4 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors ${active === section.key ? 'bg-foreground text-background' : 'border border-border'}`}
          >
            {section.label}
          </button>
        ))}
      </div>

      <div className="mt-8 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {policies[active] || 'This policy is being finalised. Please contact us for details.'}
      </div>

      <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
        <p>Questions? Write to {settings.supportEmail} or call {settings.contactPhone}.</p>
        <p className="mt-2">Last updated {formatDate(new Date())}</p>
      </div>
    </div>
  );
}
