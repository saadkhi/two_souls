import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';

export default function SiteFooter({ settings }) {
  const year = new Date().getFullYear();
  const wa = (settings.whatsapp || '').replace(/[^\d]/g, '');

  return (
    <footer className="bg-foreground text-background" style={{ backgroundColor: '#171717', color: '#F5F0E7' }}>
      <div className="mx-auto max-w-[1600px] px-5 pb-10 pt-16 lg:px-10 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            {settings.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={`${settings.brandName || 'Two Souls'} logo`}
                fittingType="fit"
                className="h-24 w-24 rounded-full ring-1 ring-[#C5A77A]/50"
              />
            ) : null}
            <p className="mt-5 font-heading text-2xl tracking-[0.3em] text-[#D4AF37]">
              {settings.wordmark || settings.brandName}
            </p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed opacity-70">{settings.brandDescription}</p>
            <div className="mt-6 flex gap-5 text-[10px] uppercase tracking-[0.24em] opacity-70">
              <a href={settings.instagram || '#'} target="_blank" rel="noreferrer" className="hover:opacity-100">
                Instagram
              </a>
              <a href={settings.facebook || '#'} target="_blank" rel="noreferrer" className="hover:opacity-100">
                Facebook
              </a>
              <a href={settings.tiktok || '#'} target="_blank" rel="noreferrer" className="hover:opacity-100">
                TikTok
              </a>
            </div>
          </div>

          <div>
            <p className="eyebrow" style={{ color: '#C5A77A' }}>Shop</p>
            <ul className="mt-5 space-y-3 text-sm opacity-80">
              <li><Link to="/shop">Shop All</Link></li>
              <li><Link to="/shop?filter=new">New Arrivals</Link></li>
              <li><Link to="/shop?filter=bestsellers">Best Sellers</Link></li>
              <li><Link to="/shop?view=collections">Collections</Link></li>
              <li><Link to="/shop?gender=Men">Men</Link></li>
              <li><Link to="/shop?gender=Women">Women</Link></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow" style={{ color: '#C5A77A' }}>Client Care</p>
            <ul className="mt-5 space-y-3 text-sm opacity-80">
              <li><Link to="/track">Track Order</Link></li>
              <li><Link to="/policies?section=shipping">Shipping Policy</Link></li>
              <li><Link to="/policies?section=returns">Returns &amp; Exchanges</Link></li>
              <li><Link to="/policies?section=privacy">Privacy Policy</Link></li>
              <li><Link to="/policies?section=terms">Terms &amp; Conditions</Link></li>
              <li><Link to="/account">My Account</Link></li>
            </ul>
          </div>

          <div>
            <p className="eyebrow" style={{ color: '#C5A77A' }}>Contact</p>
            <ul className="mt-5 space-y-3 text-sm opacity-80">
              <li>{settings.address}</li>
              <li><a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a></li>
              <li><a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></li>
              {wa ? (
                <li>
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                    WhatsApp us
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t pt-6 text-[10px] uppercase tracking-[0.22em] opacity-50 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(245,240,231,0.15)' }}>
          <p>© {year} {settings.legalName || settings.brandName}. All rights reserved.</p>
          <p>Prices in PKR · Lahore, Pakistan</p>
        </div>
      </div>
    </footer>
  );
}