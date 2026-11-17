import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Boxes, CreditCard, FileText, Image as ImageIcon, LayoutDashboard, Loader2,
  Package, Settings, ShieldAlert, ShoppingCart, Star, Store, Tag, Truck, Users,
} from 'lucide-react';
import { storeApi } from '@/api/storeClient';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/shipping', label: 'Shipping & COD', icon: Truck },
  { to: '/admin/marketing', label: 'Marketing', icon: Tag },
  { to: '/admin/content', label: 'Appearance', icon: ImageIcon },
  { to: '/admin/reviews', label: 'Reviews', icon: Star },
  { to: '/admin/reports', label: 'Reports', icon: FileText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const [state, setState] = useState({ loading: true, user: null });
  const location = useLocation();

  useEffect(() => {
    storeApi.auth
      .me()
      .then((user) => setState({ loading: false, user }))
      .catch(() => setState({ loading: false, user: null }));
  }, []);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-accent" strokeWidth={1.2} />
          <h1 className="mt-5 font-heading text-3xl">Sign in required</h1>
          <p className="mt-2 text-sm text-muted-foreground">The owner portal is available to the store owner and staff accounts only.</p>
          <Link to="/login" className="btn-luxe mt-7">Sign in</Link>
        </div>
      </div>
    );
  }

  if (state.user.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-destructive" strokeWidth={1.2} />
          <h1 className="mt-5 font-heading text-3xl">Not authorised</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account does not have owner access. Ask the store owner to grant admin rights.
          </p>
          <Link to="/" className="btn-luxe-ghost mt-7">Back to the store</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-[#2A2723] bg-[#14120F] text-[#F5F0E7] lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="border-b border-white/10 px-6 py-7">
            <p className="font-heading text-lg tracking-[0.3em] text-[#C5A77A]">TWO SOULS</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.24em] text-white/45">Owner portal</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            {NAV.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-6 py-3 text-[11px] uppercase tracking-[0.16em] transition-colors ${active ? 'bg-white/10 text-[#C5A77A]' : 'text-white/65 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.4} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-4">
            <Link to="/" className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white">
              <Store className="h-3.5 w-3.5" /> View store
            </Link>
            <p className="mt-3 truncate text-[10px] text-white/35">{state.user.email}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-5 py-3 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3 overflow-x-auto lg:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap text-[10px] uppercase tracking-[0.18em] ${location.pathname === item.to ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <p className="hidden text-[10px] uppercase tracking-[0.24em] text-muted-foreground lg:block">
            {NAV.find((n) => n.to === location.pathname)?.label || 'Owner portal'}
          </p>
          <Link to="/" className="shrink-0 text-[10px] uppercase tracking-[0.2em] underline">
            View store
          </Link>
        </header>
        <main className="px-5 py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}