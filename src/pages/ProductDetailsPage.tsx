import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Star,
  Heart,
  ShoppingCart,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  AlertCircle,
  ArrowLeft,
  Crown,
} from 'lucide-react';
import api from '../api/client';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const ProductDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { membership } = useAuth();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [justAdded, setJustAdded] = useState<boolean>(false);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        const res = await api.get(`/products/${id}`);
        if (res.data.success) {
          setProduct(res.data.data.product);
        }
      } catch (err) {
        console.error('Failed to load product details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="site-wrapper" style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading product details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="site-wrapper" style={{ padding: '80px 0', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--danger)" style={{ margin: '0 auto 16px' }} />
        <h2>Product Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          The product you are looking for does not exist or has been removed.
        </p>
        <Link to="/products" className="btn btn-primary">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);
  const isOutOfStock = product.stock <= 0;
  const currentPrice = product.discount_price || product.price;
  const discountAmount = product.discount_price ? product.price - product.discount_price : 0;

  const handleAddToCart = async () => {
    if (isOutOfStock || isAdding) return;
    setIsAdding(true);
    const ok = await addToCart(product.id, quantity);
    setIsAdding(false);
    if (ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    }
  };

  const handleBuyNow = async () => {
    if (isOutOfStock) return;
    const ok = await addToCart(product.id, quantity);
    if (ok) {
      navigate('/checkout');
    }
  };

  return (
    <div className="site-wrapper" style={{ margin: '32px auto 60px' }} id="product-details-container">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: '24px' }}
        id="back-to-results-btn"
      >
        <ArrowLeft size={16} /> Back to Products
      </button>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 1.2fr', gap: '48px', alignItems: 'flex-start' }}>
        {/* Left: Product Image Viewer */}
        <div className="card" style={{ padding: '16px', background: '#ffffff' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: 'var(--bg-surface)',
              aspectRatio: '1 / 1',
            }}
          >
            <img
              src={product.product_image}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              id="main-product-image"
            />

            {discountAmount > 0 && (
              <span className="product-card-discount-badge" style={{ fontSize: '13px', padding: '4px 10px' }}>
                Save ${discountAmount.toFixed(0)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Details & Purchase Controls */}
        <div>
          {/* Brand & Stock Pill */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {product.brand} • {product.category_name}
            </span>

            {isOutOfStock ? (
              <span className="badge badge-danger">Out of Stock</span>
            ) : product.stock <= 5 ? (
              <span className="badge badge-warning">Only {product.stock} left in stock</span>
            ) : (
              <span className="badge badge-success">In Stock ({product.stock} available)</span>
            )}
          </div>

          <h1 style={{ fontSize: '32px', marginBottom: '14px', lineHeight: 1.3 }} id="product-title">
            {product.name}
          </h1>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  fill={star <= Math.round(product.rating) ? '#f59e0b' : 'none'}
                  color="#f59e0b"
                />
              ))}
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{product.rating.toFixed(1)}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>({product.rating_count || 48} verified customer reviews)</span>
          </div>

          {/* Price Section */}
          <div
            style={{
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'baseline',
              gap: '14px',
            }}
          >
            <span style={{ fontSize: '36px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-main)' }}>
              ${Number(currentPrice).toFixed(2)}
            </span>

            {product.discount_price && (
              <span style={{ fontSize: '18px', color: 'var(--text-light)', textDecoration: 'line-through' }}>
                ${Number(product.price).toFixed(2)}
              </span>
            )}

            {membership?.active && (
              <span
                style={{
                  background: 'rgba(37, 99, 235, 0.1)',
                  color: 'var(--primary)',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Crown size={13} color="var(--primary)" /> VIP Member Discount Applies at Checkout
              </span>
            )}
          </div>

          {/* Description */}
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.7, marginBottom: '28px' }}>
            {product.description ||
              'Engineered with precision materials and state-of-the-art acoustics, providing exceptional fidelity and durability for everyday and professional use.'}
          </p>

          {/* Quantity Selector & Purchase Actions */}
          <div style={{ marginBottom: '28px' }}>
            <label className="form-label">Select Quantity:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div className="qty-counter">
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1 || isOutOfStock}
                  id="qty-decrement-btn"
                >
                  -
                </button>
                <span className="qty-val" id="qty-value">{quantity}</span>
                <button
                  type="button"
                  className="qty-btn"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock || isOutOfStock}
                  id="qty-increment-btn"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className={`btn btn-lg ${justAdded ? 'btn-success' : 'btn-primary'}`}
                style={{ flex: 1, minWidth: '180px' }}
                onClick={handleAddToCart}
                disabled={isOutOfStock || isAdding}
                id="details-add-to-cart-btn"
              >
                {justAdded ? (
                  <>
                    <Check size={18} /> Added to Cart
                  </>
                ) : isOutOfStock ? (
                  'Out of Stock'
                ) : (
                  <>
                    <ShoppingCart size={18} /> Add to Cart
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-accent btn-lg"
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                id="details-buy-now-btn"
              >
                Buy Now
              </button>

              <button
                type="button"
                className={`btn btn-outline btn-lg ${inWishlist ? 'active' : ''}`}
                onClick={() => toggleWishlist(product.id)}
                title="Save to Wishlist"
                id="details-wishlist-toggle-btn"
              >
                <Heart size={20} fill={inWishlist ? '#ef4444' : 'none'} color={inWishlist ? '#ef4444' : 'currentColor'} />
              </button>
            </div>
          </div>

          {/* Guarantees Box */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <Truck size={18} color="var(--primary)" /> Fast Express Shipping
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <ShieldCheck size={18} color="var(--success)" /> 2-Year Warranty
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <RotateCcw size={18} color="var(--accent)" /> 30-Day Free Returns
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
