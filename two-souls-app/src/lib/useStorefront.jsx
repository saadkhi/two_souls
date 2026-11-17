import { useEffect, useState } from 'react';
import { storeApi } from '@/api/storeClient';
import {
  DEFAULT_CONTENT,
  DEFAULT_SETTINGS,
  SAMPLE_COLLECTIONS,
  SAMPLE_PRODUCTS,
  SAMPLE_REVIEWS,
} from '@/lib/defaults';

const merge = (base, override) => {
  if (!override) return base;
  return {
    ...base,
    ...override,
    announcement: { ...base.announcement, ...(override.announcement || {}) },
    hero: { ...base.hero, ...(override.hero || {}) },
    brandStory: { ...base.brandStory, ...(override.brandStory || {}) },
    benefits: override.benefits?.length ? override.benefits : base.benefits,
  };
};

export function useStorefront() {
  const [state, setState] = useState({
    content: DEFAULT_CONTENT,
    settings: DEFAULT_SETTINGS,
    products: SAMPLE_PRODUCTS,
    collections: SAMPLE_COLLECTIONS,
    reviews: SAMPLE_REVIEWS,
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [contentRows, settingsRows, products, collections, reviews] = await Promise.all([
          storeApi.entities.SiteContent.filter({ key: 'main' }),
          storeApi.entities.BusinessSettings.filter({ key: 'main' }),
          storeApi.entities.Product.filter({ status: 'active' }, { sort: '-created_date', limit: 200 }),
          storeApi.entities.Collection.filter({ active: true }, { sort: 'position', limit: 50 }),
          storeApi.entities.Review.filter({ status: 'approved' }, { sort: '-created_date', limit: 50 }),
        ]);
        if (!alive) return;
        setState({
          content: merge(DEFAULT_CONTENT, contentRows[0]),
          settings: { ...DEFAULT_SETTINGS, ...(settingsRows[0] || {}) },
          products: products.items?.length ? products.items : SAMPLE_PRODUCTS,
          collections: collections.items?.length ? collections.items : SAMPLE_COLLECTIONS,
          reviews: reviews.items?.length ? reviews.items : SAMPLE_REVIEWS,
          loading: false,
        });
      } catch (error) {
        if (alive) setState((s) => ({ ...s, loading: false }));
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}