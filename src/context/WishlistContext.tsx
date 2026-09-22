import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { WishlistItem } from '../types';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useToast } from './ToastContext';

interface WishlistContextType {
  items: WishlistItem[];
  wishlistCount: number;
  isInWishlist: (productId: number) => boolean;
  toggleWishlist: (productId: number) => Promise<void>;
  addToWishlist: (productId: number) => Promise<boolean>;
  removeFromWishlist: (productId: number) => Promise<boolean>;
  moveToCart: (productId: number) => Promise<boolean>;
  refreshWishlist: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { refreshCart } = useCart();
  const { showToast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      const res = await api.get('/wishlist');
      if (res.data.success) {
        setItems(res.data.data.items || []);
      }
    } catch (err: any) {
      console.error('Failed to load wishlist:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const isInWishlist = (productId: number) => {
    return items.some((item) => item.product_id === productId);
  };

  const addToWishlist = async (productId: number): Promise<boolean> => {
    if (!user) {
      showToast('Please sign in to save items to your wishlist', 'info');
      return false;
    }

    try {
      const res = await api.post('/wishlist', { productId });
      if (res.data.success) {
        showToast('Saved to your wishlist', 'success');
        await refreshWishlist();
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save to wishlist', 'error');
      return false;
    }
  };

  const removeFromWishlist = async (productId: number): Promise<boolean> => {
    try {
      const res = await api.delete(`/wishlist/${productId}`);
      if (res.data.success) {
        showToast('Removed from wishlist', 'info');
        await refreshWishlist();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleWishlist = async (productId: number) => {
    if (isInWishlist(productId)) {
      await removeFromWishlist(productId);
    } else {
      await addToWishlist(productId);
    }
  };

  const moveToCart = async (productId: number): Promise<boolean> => {
    try {
      const res = await api.post(`/wishlist/${productId}/move-to-cart`);
      if (res.data.success) {
        showToast('Moved item to shopping cart', 'success');
        await refreshWishlist();
        await refreshCart();
        return true;
      }
      showToast(res.data.message || 'Could not move to cart', 'error');
      return false;
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to move to cart', 'error');
      return false;
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        wishlistCount: items.length,
        isInWishlist,
        toggleWishlist,
        addToWishlist,
        removeFromWishlist,
        moveToCart,
        refreshWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
