import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storeApi } from '@/api/storeClient';
import { useCart } from '@/components/cart/CartContext';
import { useStorefront } from '@/lib/useStorefront';
import { shippingFor } from '@/lib/shipping';
import { formatMoney, normalizePkPhone, PROVINCES } from '@/lib/format';
import { Image } from '@/components/ui/image';

const EMPTY = {
  customerName: '', customerPhone: '', whatsapp: '', customerEmail: '',
  province: '', city: '', district: '', area: '', street: '', house: '',
  landmark: '', postalCode: '', deliveryInstructions: '', customerNote: '',
};

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { settings } = useStorefront();
  const navigate = useNavigate();
  const idempotencyKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `key-${Date.now()}`
  );

  const [form, setForm] = useState(EMPTY);
  const [method, setMethod] = useState('cod');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [zones, setZones] = useState([]);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const symbol = settings.currencySymbol;
  const pay = settings.paymentMethods || {};
  const codEnabled = pay.cod?.enabled !== false;
  const bankEnabled = pay.bank?.enabled === true;

  useEffect(() => {
    storeApi.entities.ShippingZone.filter({ active: true }).then(setZones);
    storeApi.auth.me().then((me) => {
      setForm((f) => ({
        ...f,
        customerName: me.full_name || '',
        customerEmail: me.email || '',
      }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!codEnabled && bankEnabled) setMethod('bank_transfer');
    if (!codEnabled && !bankEnabled) setMethod('');
  }, [codEnabled, bankEnabled]);

  const shipping = useMemo(
    () => shippingFor({ subtotal: subtotal - (coupon?.discount || 0), city: form.city, province: form.province, zones, settings, method: shippingMethod }),
    [subtotal, coupon, form.city, form.province, zones, settings, shippingMethod]
  );

  const codFee = method === 'cod' && shipping.codAvailable !== false
    ? Number(pay.cod?.fee ?? settings.codFee ?? 0)
    : 0;
  const discount = coupon?.discount || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Number(settings.defaultTaxRate || 0);
  const tax = settings.taxEnabled && !settings.taxInclusive && taxRate > 0
    ? Math.round((taxable * taxRate) / 100)
    : 0;
  const total = taxable + shipping.fee + codFee + tax;

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const applyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCheckingCoupon(true);
    setCouponError('');
    try {
      const res = await storeApi.functions.invoke('validateCoupon', {
        code: couponInput.trim().toUpperCase(),
        subtotal,
        items: items.map((i) => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
      });
      if (res.data?.error) {
        setCouponError(res.data.error);
        setCoupon(null);
      } else {
        setCoupon(res.data.coupon);
        setCouponInput(res.data.coupon.code);
      }
    } catch (e) {
      setCouponError(e?.response?.data?.error || 'Could not check that code.');
    }
    setCheckingCoupon(false);
  };

  const uploadReceipt = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await storeApi.integrations.Core.UploadPrivateFile({ file });
      setReceipt({ uri: file_uri, name: file.name });
    } catch (e) {
      setError('Could not upload the receipt. Please try again.');
    }
    setUploading(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!items.length) {
      setError('Your bag is empty.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.customerEmail) && form.customerEmail) {
      setError('Enter a valid email address or leave it blank.');
      return;
    }
    if (!normalizePkPhone(form.customerPhone)) {
      setError('Enter a valid Pakistani mobile number, for example 03001234567.');
      return;
    }
    if (!method) {
      setError('Please choose a payment method.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await storeApi.functions.invoke('placeOrder', {
        ...form,
        customerPhone: normalizePkPhone(form.customerPhone),
        whatsapp: form.whatsapp ? normalizePkPhone(form.whatsapp) || form.whatsapp : '',
        paymentMethod: method,
        shippingMethod,
        couponCode: coupon?.code || '',
        receiptUri: receipt?.uri || '',
        idempotencyKey: idempotencyKey.current,
        items: items.map((i) => ({ productId: i.productId, sku: i.sku, quantity: i.quantity })),
      });
      if (res.data?.error) {
        setError(res.data.error);
        setSubmitting(false);
        return;
      }
      sessionStorage.setItem('an_last_order', JSON.stringify(res.data.order));
      sessionStorage.setItem('an_last_phone', form.customerPhone);
      clearCart();
      navigate('/order-confirmation', { replace: true });
    } catch (e) {
      setError(e?.response?.data?.error || 'We could not place your order. Please try again.');
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-5 py-28 text-center">
        <h1 className="font-heading text-4xl">Your bag is empty</h1>
        <Link to="/shop" className="btn-luxe mt-8">Explore the collection</Link>
      </div>
    );
  }

  const sectionNumber = (n) => (
    <span className="font-heading text-sm text-accent">{String(n).padStart(2, '0')}</span>
  );

  return (
    <form onSubmit={submit} className="mx-auto max-w-[1400px] px-5 py-12 lg:px-10 lg:py-16">
      <p className="eyebrow">Checkout</p>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">Complete your order</h1>

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <section>
            <div className="flex items-baseline gap-3 border-b border-border pb-3">
              {sectionNumber(1)}<h2 className="font-heading text-2xl">Your details</h2>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="customerName" className="label-luxe">Full name</label>
                <input id="customerName" required value={form.customerName} onChange={set('customerName')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="customerPhone" className="label-luxe">Mobile number</label>
                <input id="customerPhone" required inputMode="tel" placeholder="03001234567" value={form.customerPhone} onChange={set('customerPhone')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="whatsapp" className="label-luxe">WhatsApp number (optional)</label>
                <input id="whatsapp" inputMode="tel" placeholder="+92 300 1234567" value={form.whatsapp} onChange={set('whatsapp')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="customerEmail" className="label-luxe">Email (optional)</label>
                <input id="customerEmail" type="email" value={form.customerEmail} onChange={set('customerEmail')} className="field-luxe" />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-baseline gap-3 border-b border-border pb-3">
              {sectionNumber(2)}<h2 className="font-heading text-2xl">Delivery address</h2>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="province" className="label-luxe">Province / region</label>
                <select id="province" required value={form.province} onChange={set('province')} className="field-luxe">
                  <option value="">Select region</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="city" className="label-luxe">City</label>
                <input id="city" required list="city-options" value={form.city} onChange={set('city')} className="field-luxe" />
                <datalist id="city-options">
                  {[...new Set(zones.flatMap((z) => z.cities || []))].map((city) => (
                    <option key={city} value={city} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="district" className="label-luxe">District</label>
                <input id="district" value={form.district} onChange={set('district')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="area" className="label-luxe">Area / locality</label>
                <input id="area" value={form.area} onChange={set('area')} className="field-luxe" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="street" className="label-luxe">Complete street address</label>
                <input id="street" required value={form.street} onChange={set('street')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="house" className="label-luxe">House / building</label>
                <input id="house" value={form.house} onChange={set('house')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="landmark" className="label-luxe">Nearby landmark</label>
                <input id="landmark" value={form.landmark} onChange={set('landmark')} className="field-luxe" />
              </div>
              <div>
                <label htmlFor="postalCode" className="label-luxe">Postal code</label>
                <input id="postalCode" inputMode="numeric" value={form.postalCode} onChange={set('postalCode')} className="field-luxe" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="deliveryInstructions" className="label-luxe">Delivery instructions</label>
                <textarea id="deliveryInstructions" rows={2} value={form.deliveryInstructions} onChange={set('deliveryInstructions')} className="field-luxe" />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-baseline gap-3 border-b border-border pb-3">
              {sectionNumber(3)}<h2 className="font-heading text-2xl">Delivery method</h2>
            </div>
            <div className="mt-5 space-y-3">
              {[
                { key: 'standard', label: 'Standard delivery', fee: shipping.fee, note: `${shipping.minDays}–${shipping.maxDays} working days` },
                { key: 'express', label: 'Express delivery', fee: shipping.method === 'express' ? shipping.fee : Math.max(shipping.fee, Number(settings.expressShippingFee || 0)), note: 'Priority dispatch, 1–2 working days in major cities' },
              ].map((option) => (
                <label
                  key={option.key}
                  className={`flex cursor-pointer items-center justify-between gap-4 border p-4 text-sm transition-colors ${shippingMethod === option.key ? 'border-foreground bg-card' : 'border-border'}`}
                >
                  <span className="flex items-center gap-3">
                    <input type="radio" name="shipping" checked={shippingMethod === option.key} onChange={() => setShippingMethod(option.key)} />
                    <span>
                      <span className="block">{option.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{option.note}</span>
                    </span>
                  </span>
                  <span className="text-sm">{option.fee === 0 ? 'Complimentary' : formatMoney(option.fee, symbol)}</span>
                </label>
              ))}
              {shipping.restricted ? (
                <p className="text-xs text-destructive">We do not deliver to this city yet. Please choose another address.</p>
              ) : null}
            </div>
          </section>

          <section>
            <div className="flex items-baseline gap-3 border-b border-border pb-3">
              {sectionNumber(4)}<h2 className="font-heading text-2xl">Payment</h2>
            </div>
            <div className="mt-5 space-y-3">
              {codEnabled ? (
                <label className={`flex cursor-pointer gap-3 border p-4 ${method === 'cod' ? 'border-foreground bg-card' : 'border-border'}`}>
                  <input type="radio" name="payment" checked={method === 'cod'} onChange={() => setMethod('cod')} />
                  <span>
                    <span className="block text-sm">Cash on delivery</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Pay the rider in cash. {codFee > 0 ? `A handling fee of ${formatMoney(codFee, symbol)} applies.` : 'No handling fee.'}
                    </span>
                  </span>
                </label>
              ) : null}

              {bankEnabled ? (
                <label className={`flex cursor-pointer gap-3 border p-4 ${method === 'bank_transfer' ? 'border-foreground bg-card' : 'border-border'}`}>
                  <input type="radio" name="payment" checked={method === 'bank_transfer'} onChange={() => setMethod('bank_transfer')} />
                  <span className="flex-1">
                    <span className="block text-sm">Bank transfer</span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      Transfer the total, then upload your receipt. Your order is marked awaiting verification until we confirm the payment.
                    </span>
                  </span>
                </label>
              ) : null}

              {method === 'bank_transfer' ? (
                <div className="border border-border bg-card p-5 text-xs leading-relaxed">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Transfer to</p>
                  <p className="mt-2">{pay.bank?.bankName}</p>
                  <p>{pay.bank?.accountTitle}</p>
                  <p>Account {pay.bank?.accountNumber}</p>
                  {pay.bank?.iban ? <p>IBAN {pay.bank?.iban}</p> : null}
                  <p className="mt-3 text-muted-foreground">{pay.bank?.instructions}</p>
                  <div className="mt-4">
                    <label htmlFor="receipt" className="label-luxe">Upload payment receipt (optional)</label>
                    <input id="receipt" type="file" accept="image/*,application/pdf" onChange={uploadReceipt} className="mt-2 block w-full text-xs" />
                    {uploading ? <p className="mt-2 text-muted-foreground">Uploading…</p> : null}
                    {receipt ? <p className="mt-2">Attached: {receipt.name}</p> : null}
                  </div>
                </div>
              ) : null}

              {!codEnabled && !bankEnabled ? (
                <p className="text-xs text-destructive">No payment method is active. Please contact us to place this order.</p>
              ) : null}

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Safepay, JazzCash and Easypaisa are being onboarded. They will appear here once our merchant accounts and server-side verification are live.
              </p>
            </div>
          </section>

          <section>
            <div className="flex items-baseline gap-3 border-b border-border pb-3">
              {sectionNumber(5)}<h2 className="font-heading text-2xl">Order note</h2>
            </div>
            <label htmlFor="customerNote" className="label-luxe mt-5">Anything we should know? (optional)</label>
            <textarea id="customerNote" rows={2} value={form.customerNote} onChange={set('customerNote')} className="field-luxe" />
          </section>
        </div>

        <aside className="h-fit border border-border bg-card p-6 lg:sticky lg:top-28">
          <p className="eyebrow">Your order</p>
          <div className="mt-5 space-y-4">
            {items.map((item) => (
              <div key={item.key} className="flex gap-3">
                <Image src={item.image} alt={item.name} className="aspect-[3/4] w-14 shrink-0" />
                <div className="flex-1 text-xs">
                  <p className="font-heading text-base leading-tight">{item.name}</p>
                  <p className="mt-0.5 text-muted-foreground">{item.size} × {item.quantity}</p>
                </div>
                <span className="text-xs">{formatMoney(item.price * item.quantity, symbol)}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <label htmlFor="coupon" className="label-luxe">Offer code</label>
            <div className="mt-2 flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value); setCouponError(''); }}
                placeholder="Enter code"
                className="field-luxe flex-1 uppercase"
              />
              <button type="button" onClick={applyCoupon} disabled={checkingCoupon} className="border border-foreground px-4 text-[10px] uppercase tracking-[0.2em] disabled:opacity-50">
                {checkingCoupon ? '…' : 'Apply'}
              </button>
            </div>
            {couponError ? <p className="mt-2 text-[11px] text-destructive">{couponError}</p> : null}
            {coupon ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {coupon.code} applied — {formatMoney(discount, symbol)} off
              </p>
            ) : null}
          </div>

          <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(subtotal, symbol)}</dd></div>
            {discount > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>− {formatMoney(discount, symbol)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{shipping.fee === 0 ? 'Complimentary' : formatMoney(shipping.fee, symbol)}</dd></div>
            {codFee > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">COD handling</dt><dd>{formatMoney(codFee, symbol)}</dd></div> : null}
            {tax > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(tax, symbol)}</dd></div> : null}
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="text-[10px] uppercase tracking-[0.22em]">Total payable</dt>
              <dd className="font-heading text-2xl">{formatMoney(total, symbol)}</dd>
            </div>
          </dl>

          {error ? <p className="mt-4 border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">{error}</p> : null}

          <button type="submit" disabled={submitting || shipping.restricted} className="btn-luxe mt-5 w-full disabled:opacity-50">
            {submitting ? 'Placing order…' : `Place order · ${formatMoney(total, symbol)}`}
          </button>
          <p className="mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            By placing this order you agree to our terms and returns policy.
          </p>
        </aside>
      </div>
    </form>
  );
}