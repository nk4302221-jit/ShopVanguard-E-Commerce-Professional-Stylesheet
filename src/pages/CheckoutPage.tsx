import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Truck,
  Crown,
  Lock,
} from 'lucide-react';
import api from '../api/client';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Address } from '../types';
import { GoogleMapsPicker } from '../components/GoogleMapsPicker';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, totals, clearCart } = useCart();
  const { user, membership } = useAuth();
  const { showToast } = useToast();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'stripe' | 'cod'>('razorpay');
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Address creation form state
  const [showAddressForm, setShowAddressForm] = useState<boolean>(false);
  const [addressForm, setAddressForm] = useState({
    fullName: user?.full_name || '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: true,
    latitude: 28.6139,
    longitude: 77.209,
  });

  // Fetch user's saved addresses
  useEffect(() => {
    async function fetchAddresses() {
      try {
        setLoading(true);
        const res = await api.get('/addresses');
        if (res.data.success) {
          const list = res.data.data.addresses;
          setAddresses(list);
          const defaultAddr = list.find((a: Address) => a.is_default) || list[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr.id);
          } else {
            setShowAddressForm(true);
          }
        }
      } catch (err) {
        console.error('Failed to load addresses:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAddresses();
  }, []);

  // Dynamically load Razorpay checkout script
  useEffect(() => {
    if (!document.getElementById('razorpay-checkout-script')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressForm.addressLine1 || !addressForm.city || !addressForm.postalCode) {
      showToast('Please fill all mandatory address fields', 'error');
      return;
    }

    try {
      const res = await api.post('/addresses', {
        fullName: addressForm.fullName,
        phone: addressForm.phone,
        addressLine1: addressForm.addressLine1,
        addressLine2: addressForm.addressLine2,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.postalCode,
        country: addressForm.country,
        isDefault: addressForm.isDefault,
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
      });

      if (res.data.success) {
        showToast('Delivery address saved successfully!', 'success');
        const created = res.data.data.address;
        setAddresses([created, ...addresses]);
        setSelectedAddressId(created.id);
        setShowAddressForm(false);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save address', 'error');
    }
  };

  const handleLocationPicked = (loc: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) => {
    setAddressForm((prev) => ({
      ...prev,
      addressLine1: loc.address,
      city: loc.city,
      state: loc.state,
      postalCode: loc.postalCode,
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));
  };

  // Place Order & Execute Selected Gateway (Razorpay / Stripe / COD)
  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      showToast('Please select or add a delivery address', 'error');
      return;
    }

    if (items.length === 0) {
      showToast('Your shopping cart is empty', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Order in SQL Database
      const createRes = await api.post('/orders', {
        addressId: selectedAddressId,
        paymentMethod,
      });

      if (!createRes.data.success) {
        throw new Error(createRes.data.message || 'Order creation failed');
      }

      const order = createRes.data.data.order;

      // Step 2: Handle Gateway Checkout
      if (paymentMethod === 'razorpay') {
        // Initiate Razorpay Order from backend
        const rzpRes = await api.post('/orders/razorpay/create-order', {
          orderId: order.id,
        });

        const rzpData = rzpRes.data.data;

        // Check if Razorpay JS SDK is loaded
        const RazorpayWindow = (window as any).Razorpay;

        if (RazorpayWindow && !rzpData.isSandboxMock) {
          const options = {
            key: rzpData.keyId,
            amount: rzpData.amount,
            currency: rzpData.currency || 'INR',
            name: 'ShopVanguard E-Commerce',
            description: `Order #${order.order_number}`,
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&auto=format&fit=crop&q=80',
            order_id: rzpData.orderId,
            handler: async function (response: any) {
              try {
                // Verify payment on backend
                const verifyRes = await api.post('/orders/razorpay/verify-payment', {
                  orderId: order.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });

                if (verifyRes.data.success) {
                  clearCart();
                  showToast('Razorpay payment verified! Order confirmed.', 'success');
                  navigate(`/orders/confirmed/${order.id}`);
                }
              } catch (verErr: any) {
                showToast(verErr.response?.data?.message || 'Payment signature verification failed', 'error');
              }
            },
            prefill: {
              name: user?.full_name || '',
              email: user?.email || '',
              contact: user?.phone || '9876543210',
            },
            theme: {
              color: '#2563eb',
            },
          };

          const rzpInstance = new RazorpayWindow(options);
          rzpInstance.open();
          setIsProcessing(false);
          return;
        } else {
          // High-fidelity sandbox/test verification mode
          showToast('Processing Razorpay Sandbox Payment...', 'info');
          const mockPaymentId = `pay_rzp_${Date.now()}`;
          const mockSignature = `sig_rzp_${Date.now()}`;

          const verifyRes = await api.post('/orders/razorpay/verify-payment', {
            orderId: order.id,
            razorpayOrderId: rzpData.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
          });

          if (verifyRes.data.success) {
            clearCart();
            showToast('Razorpay sandbox payment verified! Order confirmed.', 'success');
            navigate(`/orders/confirmed/${order.id}`);
          }
        }
      } else if (paymentMethod === 'stripe') {
        // Stripe Sandbox Flow
        const stripeRes = await api.post('/orders/create-checkout-session', {
          orderId: order.id,
        });

        if (stripeRes.data.success) {
          const session = stripeRes.data.data;
          if (session.checkoutUrl && !session.isSandboxMock) {
            window.location.href = session.checkoutUrl;
          } else {
            // Confirm test payment
            await api.post(`/orders/${order.id}/confirm-payment`, {
              sessionId: session.sessionId,
            });
            clearCart();
            showToast('Stripe payment confirmed! Order placed successfully.', 'success');
            navigate(`/orders/confirmed/${order.id}`);
          }
        }
      } else {
        // Cash on Delivery
        clearCart();
        showToast('Order placed successfully via Cash on Delivery!', 'success');
        navigate(`/orders/confirmed/${order.id}`);
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Checkout failed. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="site-wrapper" style={{ margin: '80px auto', maxWidth: '500px', textAlign: 'center' }}>
        <div className="card" style={{ padding: '40px' }}>
          <h2>No Items to Checkout</h2>
          <p style={{ color: 'var(--text-muted)', margin: '16px 0 24px' }}>Your shopping cart is currently empty.</p>
          <Link to="/products" className="btn btn-primary">Return to Catalog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="site-wrapper" style={{ margin: '36px auto 80px' }} id="checkout-page-container">
      <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Secure Checkout</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Complete your order with verified address and instant Razorpay payment
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '40px', alignItems: 'flex-start' }}>
        {/* Left Column: Address Selection & Payment Method */}
        <div>
          {/* Section 1: Delivery Address */}
          <div className="card" style={{ padding: '24px', marginBottom: '28px' }} id="checkout-address-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="var(--primary)" /> 1. Shipping Address
              </h2>
              {!showAddressForm && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddressForm(true)}
                  id="add-new-address-toggle-btn"
                >
                  <Plus size={14} /> Add New Address
                </button>
              )}
            </div>

            {/* List of existing saved addresses */}
            {!showAddressForm && addresses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => setSelectedAddressId(addr.id)}
                    style={{
                      border: selectedAddressId === addr.id ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      background: selectedAddressId === addr.id ? 'var(--primary-light)' : '#ffffff',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                    id={`address-option-${addr.id}`}
                  >
                    <div style={{ marginTop: '2px' }}>
                      <input
                        type="radio"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {addr.full_name}
                        {addr.is_default ? (
                          <span className="badge badge-primary" style={{ fontSize: '10px' }}>Default</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {addr.address_line1}, {addr.address_line2 ? addr.address_line2 + ', ' : ''}
                        {addr.city}, {addr.state} {addr.postal_code}, {addr.country}
                      </div>
                      {addr.phone && (
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>
                          Phone: {addr.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Address Form with Google Maps integration */}
            {showAddressForm && (
              <form onSubmit={handleSaveAddress} style={{ marginTop: '16px' }} id="new-address-form">
                <GoogleMapsPicker onLocationSelect={handleLocationPicked} />

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    id="addr-fullname-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    className="form-control"
                    required
                    placeholder="+91 9876543210"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    id="addr-phone-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Street Address *</label>
                  <input
                    type="text"
                    className="form-control"
                    required
                    placeholder="Flat / House no, Building, Street"
                    value={addressForm.addressLine1}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine1: e.target.value })}
                    id="addr-line1-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Apartment / Suite (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Floor, Landmark"
                    value={addressForm.addressLine2}
                    onChange={(e) => setAddressForm({ ...addressForm, addressLine2: e.target.value })}
                    id="addr-line2-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">City *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      id="addr-city-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">State *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={addressForm.state}
                      onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                      id="addr-state-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Postal / PIN Code *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={addressForm.postalCode}
                      onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                      id="addr-postal-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" id="save-address-btn">
                    Save Address
                  </button>
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowAddressForm(false)}
                      id="cancel-address-btn"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Section 2: Payment Gateway Selection */}
          <div className="card" style={{ padding: '24px' }} id="checkout-payment-section">
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <CreditCard size={20} color="var(--primary)" /> 2. Choose Payment Method
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Razorpay Option */}
              <div
                onClick={() => setPaymentMethod('razorpay')}
                style={{
                  border: paymentMethod === 'razorpay' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'razorpay' ? 'var(--primary-light)' : '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                id="payment-option-razorpay"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                      Razorpay Checkout (UPI, Cards, Netbanking)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Pay securely with Google Pay, PhonePe, Paytm, Visa, Mastercard, or Netbanking
                    </div>
                  </div>
                </div>
                <span className="badge badge-primary">Recommended</span>
              </div>

              {/* Stripe Option */}
              <div
                onClick={() => setPaymentMethod('stripe')}
                style={{
                  border: paymentMethod === 'stripe' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'stripe' ? 'var(--primary-light)' : '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                id="payment-option-stripe"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                      Stripe Sandbox Payments
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      International cards with 3D Secure verification
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash on Delivery Option */}
              <div
                onClick={() => setPaymentMethod('cod')}
                style={{
                  border: paymentMethod === 'cod' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'cod' ? 'var(--primary-light)' : '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                id="payment-option-cod"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    style={{ cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                      Cash on Delivery (COD)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Pay in cash upon doorstep package arrival
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Place Order CTA */}
        <div className="order-summary-box">
          <h2 style={{ fontSize: '20px', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            Order Summary ({items.length} items)
          </h2>

          <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((it) => (
              <div key={it.item_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-main)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {it.quantity}x {it.name}
                </span>
                <span style={{ fontWeight: 600 }}>
                  ${((it.discount_price || it.price) * it.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="summary-row">
            <span>Subtotal</span>
            <span>${totals.subtotal.toFixed(2)}</span>
          </div>

          {totals.discount > 0 && (
            <div className="summary-row" style={{ color: 'var(--success)' }}>
              <span>Promotional Savings</span>
              <span>-${totals.discount.toFixed(2)}</span>
            </div>
          )}

          {membership?.active && totals.membershipDiscount > 0 && (
            <div className="summary-row" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Crown size={14} /> VIP Pass Discount
              </span>
              <span>-${totals.membershipDiscount.toFixed(2)}</span>
            </div>
          )}

          <div className="summary-row">
            <span>Shipping</span>
            <span>{totals.shipping === 0 ? 'FREE' : `$${totals.shipping.toFixed(2)}`}</span>
          </div>

          <div className="summary-row total">
            <span>Total Payable</span>
            <span style={{ color: 'var(--primary)' }}>${totals.total.toFixed(2)}</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '20px' }}
            onClick={handlePlaceOrder}
            disabled={isProcessing || !selectedAddressId}
            id="pay-now-button"
          >
            {isProcessing ? (
              'Processing Payment...'
            ) : paymentMethod === 'razorpay' ? (
              <>
                <Lock size={18} /> Pay with Razorpay (${totals.total.toFixed(2)})
              </>
            ) : paymentMethod === 'stripe' ? (
              <>
                <Lock size={18} /> Pay with Stripe (${totals.total.toFixed(2)})
              </>
            ) : (
              'Confirm Order (Cash on Delivery)'
            )}
          </button>

          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <ShieldCheck size={16} color="var(--success)" /> Verified SSL Secure Gateway
          </div>
        </div>
      </div>
    </div>
  );
};
