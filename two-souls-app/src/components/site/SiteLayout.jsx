import { Outlet } from 'react-router-dom';
import { CartProvider } from '@/components/cart/CartContext';
import { WishlistProvider } from '@/lib/wishlist';
import { useStorefront } from '@/lib/useStorefront';
import AnnouncementBar from '@/components/site/AnnouncementBar';
import SiteHeader from '@/components/site/SiteHeader';
import SiteFooter from '@/components/site/SiteFooter';
import CartDrawer from '@/components/site/CartDrawer';

export default function SiteLayout() {
  const { content, settings } = useStorefront();

  return (
    <WishlistProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <AnnouncementBar announcement={content.announcement} />
          <SiteHeader settings={settings} />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter settings={settings} />
          <CartDrawer
            currencySymbol={settings.currencySymbol}
            freeShippingThreshold={settings.freeShippingThreshold}
          />
        </div>
      </CartProvider>
    </WishlistProvider>
  );
}
