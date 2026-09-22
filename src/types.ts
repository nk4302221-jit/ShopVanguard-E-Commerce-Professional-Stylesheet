export interface User {
  id: number;
  name?: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  avatar_url?: string;
  profile_image?: string;
  email_verified: boolean;
  active_plan_id?: number | null;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  category_id?: number;
  category_name: string;
  brand: string;
  price: number;
  discount_price?: number | null;
  stock: number;
  product_image: string;
  rating: number;
  rating_count?: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface CartItem {
  item_id: number;
  quantity: number;
  product_id: number;
  name: string;
  description?: string;
  brand: string;
  category_name: string;
  price: number;
  discount_price?: number | null;
  stock: number;
  product_image: string;
  status: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  membershipDiscount: number;
  shipping: number;
  total: number;
}

export interface WishlistItem {
  wishlist_item_id: number;
  product_id: number;
  name: string;
  description?: string;
  brand: string;
  category_name: string;
  price: number;
  discount_price?: number | null;
  stock: number;
  product_image: string;
  rating: number;
  status: string;
}

export interface Address {
  id: number;
  user_id: number;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
  is_default: number | boolean;
  created_at?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  image_url?: string;
  product_image?: string;
}

export interface Order {
  id: number;
  order_number?: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  address_id: number;
  subtotal: number;
  discount: number;
  discount_amount?: number;
  shipping: number;
  shipping_fee?: number;
  total_amount: number;
  payment_method?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  stripe_payment_id?: string;
  stripe_session_id?: string;
  created_at: string;
  shipping_name?: string;
  shipping_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  total_items?: number;
  items?: OrderItem[];
}

export interface Plan {
  id: number;
  name: string;
  slug?: string;
  price: number;
  duration_hours: number;
  benefits: string[];
  status: string;
}

export type MembershipPlan = Plan;

export interface MembershipStatus {
  active: boolean;
  plan_id?: number;
  plan_name?: string;
  expiry_time?: string;
  duration_hours?: number;
  benefits?: string[];
  membership?: {
    id: number;
    plan_id: number;
    plan_name: string;
    price: number;
    duration_hours: number;
    start_time: string;
    expiry_time: string;
    status: string;
    benefits: string[];
  } | null;
}
