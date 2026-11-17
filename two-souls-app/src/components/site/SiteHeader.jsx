import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/lib/wishlist';
import BrandMark from '@/components/site/BrandMark';

const NAV = [
  { label: 'Shop All', to: '/shop' },
  { label: 'Men', to: '/shop?gender=Men' },
  { label: 'Women', to: '/shop?gender=Women' },
  { label: 'Unisex', to: '/shop?gender=Unisex' },
  { label: 'Collections', to: '/shop?view=collections' },
  { label: 'New Arrivals', to: '/shop?filter=new' },
  { label: 'Best Sellers', to: '/shop?filter=bestsellers' },
  { label: 'About', to: '/about' },
];

export default function SiteHeader({ settings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [term, setTerm] = useState('');
  const { count, openCart } = useCart();
  const wishlist = useWishlist();
  const navigate = useNavigate();

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/shop?q=${encodeURIComponent(term.trim())}`);
    setSearchOpen(false);
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto grid max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4 lg:px-10">
        <div className="flex items-center gap-6">
          <button
            type="button"
            aria-label="Open menu"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" strokeWidth={1.25} />
          </button>
          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.slice(0, 4).map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="text-[10px] uppercase tracking-[0.24em] text-foreground/65 transition-colors hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <BrandMark settings={settings} className="justify-center" />

        <div className="flex items-center justify-end gap-4 sm:gap-5">
          <button type="button" aria-label="Search" onClick={() => setSearchOpen((s) => !s)}>
            {searchOpen ? <X className="h-5 w-5" strokeWidth={1.25} /> : <Search className="h-5 w-5" strokeWidth={1.25} />}
          </button>
          <Link to="/account" aria-label="Account" className="hidden sm:block">
            <User className="h-5 w-5" strokeWidth={1.25} />
          </Link>
          <Link to="/wishlist" aria-label="Wishlist" className="relative">
            <Heart className="h-5 w-5" strokeWidth={1.25} />
            {wishlist.count > 0 ? (
              <span className="absolute -right-2 -top-2 text-[9px] tabular-nums">{wishlist.count}</span>
            ) : null}
          </Link>
          <button type="button" aria-label="Open bag" className="relative" onClick={openCart}>
            <ShoppingBag className="h-5 w-5" strokeWidth={1.25} />
            {count > 0 ? (
              <span className="absolute -right-2 -top-2 text-[9px] tabular-nums">{count}</span>
            ) : null}
          </button>
        </div>
      </div>

      {searchOpen ? (
        <form onSubmit={submitSearch} className="border-t border-border/70">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-5 py-3 lg:px-10">
            <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.25} />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search fragrances, notes, collections"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
            <button type="submit" className="text-[10px] uppercase tracking-[0.24em]">
              Search
            </button>
          </div>
        </form>
      ) : null}

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm border-r border-border bg-background p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <BrandMark settings={settings} />
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <X className="h-5 w-5" strokeWidth={1.25} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-6 py-6">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-border/60 py-4 font-heading text-2xl"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-8 space-y-3">
                <Link to="/account" onClick={() => setMenuOpen(false)} className="block text-[11px] uppercase tracking-[0.22em]">
                  My Account
                </Link>
                <Link to="/wishlist" onClick={() => setMenuOpen(false)} className="block text-[11px] uppercase tracking-[0.22em]">
                  Wishlist
                </Link>
                <Link to="/track" onClick={() => setMenuOpen(false)} className="block text-[11px] uppercase tracking-[0.22em]">
                  Track Order
                </Link>
              </div>
            </nav>
            <div className="border-t border-border px-6 py-5">
              <a
                href={`https://wa.me/${(settings.whatsapp || '').replace(/[^\d]/g, '')}`}
                className="text-[11px] uppercase tracking-[0.22em]"
              >
                WhatsApp {settings.whatsapp}
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}