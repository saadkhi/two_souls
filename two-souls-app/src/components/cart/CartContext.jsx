import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CartContext = createContext(null);
const STORAGE_KEY = 'an_cart_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (error) {
      // ignore malformed storage
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const addItem = (product, variant, quantity = 1) => {
    if (!product || !variant) return;
    const key = `${product.id}::${variant.sku}`;
    setItems((current) => {
      const existing = current.find((i) => i.key === key);
      if (existing) {
        return current.map((i) =>
          i.key === key ? { ...i, quantity: Math.min(i.quantity + quantity, 99) } : i
        );
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          slug: product.slug,
          name: product.name,
          family: product.family || '',
          image: (product.images || [])[0] || '',
          size: variant.size,
          sku: variant.sku,
          price: Number(variant.salePrice || variant.price || 0),
          compareAt: variant.salePrice ? Number(variant.price || 0) : null,
          quantity,
        },
      ];
    });
    setIsOpen(true);
  };

  const updateQuantity = (key, quantity) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((i) => i.key !== key)
        : current.map((i) => (i.key === key ? { ...i, quantity: Math.min(quantity, 99) } : i))
    );
  };

  const removeItem = (key) => setItems((current) => current.filter((i) => i.key !== key));
  const clearCart = () => setItems([]);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const value = {
    items,
    count,
    subtotal,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}