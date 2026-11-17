import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function BrandMark({ settings, className = '', size = 'md', showWordmark = true }) {
  const logoSize = size === 'lg' ? 'h-24 w-24' : 'h-14 w-14 sm:h-16 sm:w-16';
  const wordmarkSize = size === 'lg' ? 'text-2xl' : 'text-[11px] sm:text-base';

  return (
    <Link to="/" className={`inline-flex items-center gap-3 leading-none ${className}`}>
      {settings?.logoUrl ? (
        <Image
          src={settings.logoUrl}
          alt={`${settings.brandName || 'Two Souls'} logo`}
          fittingType="fit"
          className={`${logoSize} shrink-0 rounded-full ring-1 ring-accent/50`}
        />
      ) : null}
      {showWordmark ? (
        <span className={`font-heading tracking-[0.34em] text-foreground ${wordmarkSize}`}>
          {settings.wordmark || settings.brandName}
        </span>
      ) : null}
    </Link>
  );
}