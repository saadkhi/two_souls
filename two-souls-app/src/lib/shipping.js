export function findZone(zones, city, province) {
  const c = (city || '').trim().toLowerCase();
  const p = (province || '').trim().toLowerCase();
  return (zones || []).find(
    (z) =>
      (z.cities || []).some((x) => x.toLowerCase() === c) ||
      (z.provinces || []).some((x) => x.toLowerCase() === p)
  );
}

export function shippingFor({ subtotal, city, province, zones, settings, method = 'standard' }) {
  const zone = findZone(zones, city, province);
  if (zone && zone.zoneType === 'restricted') {
    return { restricted: true, fee: 0, codAvailable: false, zone, minDays: null, maxDays: null };
  }
  const threshold = Number(settings?.freeShippingThreshold || 0);
  const free = threshold > 0 && subtotal >= threshold;
  const base = zone ? Number(zone.fee || 0) : Number(settings?.standardShippingFee || 0);
  const express = zone
    ? Number(zone.expressFee || settings?.expressShippingFee || 0)
    : Number(settings?.expressShippingFee || 0);

  let fee = free && method !== 'express' ? 0 : base;
  if (method === 'express') fee = free ? express : express || base;

  return {
    restricted: false,
    fee,
    free,
    zone,
    codAvailable: zone ? zone.codAvailable !== false : true,
    minDays: zone?.minDays ?? 2,
    maxDays: zone?.maxDays ?? 5,
  };
}