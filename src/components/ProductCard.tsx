import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ShoppingCart, Check } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const inWishlist = isInWishlist(product.id);
  const isOutOfStock = product.stock <= 0;

  const discountAmount = product.discount_price ? product.price - product.discount_price : 0;
  const displayPrice = product.discount_price || product.price;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock || isAdding) return;

    setIsAdding(true);
    const ok = await addToCart(product.id, 1);
    setIsAdding(false);

    if (ok) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1800);
    }
  };

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    await toggleWishlist(product.id);
  };

  return (
    <div className="product-card" id={`product-card-${product.id}`}>
      {/* Product Image with Wishlist & Discount overlay */}
      <div className="product-card-img-wrap">
        <Link to={`/products/${product.id}`}>
          <img
            src={product.product_image}
            alt={product.name}
            className="product-card-img"
            loading="lazy"
          />
        </Link>

        {discountAmount > 0 && (
          <span className="product-card-discount-badge">
            Save ${discountAmount.toFixed(0)}
          </span>
        )}

        <button
          type="button"
          className={`product-card-wishlist-btn ${inWishlist ? 'active' : ''}`}
          onClick={handleWishlistToggle}
          title={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
          id={`wishlist-btn-${product.id}`}
        >
          <Heart size={18} fill={inWishlist ? '#ef4444' : 'none'} color={inWishlist ? '#ef4444' : 'currentColor'} />
        </button>
      </div>

      {/* Content */}
      <div className="product-card-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span className="product-card-brand">{product.brand}</span>
          {isOutOfStock ? (
            <span className="badge badge-danger" style={{ fontSize: '10px' }}>Out of Stock</span>
          ) : product.stock <= 5 ? (
            <span className="badge badge-warning" style={{ fontSize: '10px' }}>Only {product.stock} left</span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: '10px' }}>In Stock</span>
          )}
        </div>

        <Link to={`/products/${product.id}`} className="product-card-title" title={product.name}>
          {product.name}
        </Link>

        {/* Rating */}
        <div className="product-card-rating">
          <Star size={14} className="star-icon" />
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{product.rating.toFixed(1)}</span>
          <span>({product.rating_count || 48})</span>
        </div>

        {/* Footer: Price + Quick Cart CTA */}
        <div className="product-card-footer">
          <div className="product-card-price-wrap">
            <span className="product-card-price">${Number(displayPrice).toFixed(2)}</span>
            {product.discount_price && (
              <span className="product-card-original-price">${Number(product.price).toFixed(2)}</span>
            )}
          </div>

          <button
            type="button"
            className={`btn btn-sm ${justAdded ? 'btn-success' : 'btn-primary'}`}
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding}
            id={`add-to-cart-${product.id}`}
          >
            {justAdded ? (
              <>
                <Check size={14} /> Added
              </>
            ) : isOutOfStock ? (
              'Sold Out'
            ) : (
              <>
                <ShoppingCart size={14} /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
