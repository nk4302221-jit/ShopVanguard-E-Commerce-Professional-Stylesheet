import React, { useState, useEffect } from 'react';
import {
  Package,
  ShoppingBag,
  DollarSign,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
} from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Product, Order, User as UserType } from '../types';

export const AdminDashboardPage: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'analytics' | 'products' | 'orders' | 'users'>('analytics');
  const [loading, setLoading] = useState<boolean>(true);

  // Analytics State
  const [stats, setStats] = useState<any>({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    lowStockCount: 0,
    recentOrders: [],
  });

  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    discount_price: '',
    stock: '',
    brand: '',
    category_id: 1,
    product_image: '',
  });

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);

  // Users State
  const [users, setUsers] = useState<UserType[]>([]);

  // Categories list
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  // Load Data
  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, productsRes, ordersRes, usersRes, catsRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/products?limit=100'),
        api.get('/admin/orders'),
        api.get('/admin/users'),
        api.get('/products/categories'),
      ]);

      if (statsRes.data.success) setStats(statsRes.data.data.stats);
      if (productsRes.data.success) setProducts(productsRes.data.products);
      if (ordersRes.data.success) setOrders(ordersRes.data.data.orders);
      if (usersRes.data.success) setUsers(usersRes.data.data.users);
      if (catsRes.data.success) setCategories(catsRes.data.data.categories);
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      showToast('Failed to load administrative records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Save / Update Product
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        discount_price: productForm.discount_price ? parseFloat(productForm.discount_price) : null,
        stock: parseInt(productForm.stock, 10),
        brand: productForm.brand,
        category_id: Number(productForm.category_id),
        product_image: productForm.product_image || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      };

      if (editingProductId) {
        const res = await api.put(`/admin/products/${editingProductId}`, payload);
        if (res.data.success) {
          showToast('Product updated successfully!', 'success');
        }
      } else {
        const res = await api.post('/admin/products', payload);
        if (res.data.success) {
          showToast('New product added to catalog!', 'success');
        }
      }

      setShowProductModal(false);
      setEditingProductId(null);
      setProductForm({
        name: '',
        description: '',
        price: '',
        discount_price: '',
        stock: '',
        brand: '',
        category_id: 1,
        product_image: '',
      });
      loadAdminData();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save product', 'error');
    }
  };

  const handleEditProductClick = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      discount_price: p.discount_price ? String(p.discount_price) : '',
      stock: String(p.stock),
      brand: p.brand,
      category_id: p.category_id || 1,
      product_image: p.product_image,
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await api.delete(`/admin/products/${id}`);
      if (res.data.success) {
        showToast('Product deleted', 'success');
        setProducts(products.filter((p) => p.id !== id));
      }
    } catch (err: any) {
      showToast('Failed to delete product', 'error');
    }
  };

  // Change Order Status
  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await api.put(`/admin/orders/${orderId}/status`, { orderStatus: newStatus });
      if (res.data.success) {
        showToast(`Order status updated to ${newStatus}`, 'success');
        setOrders(orders.map((o) => (o.id === orderId ? { ...o, order_status: newStatus as any } : o)));
      }
    } catch (err: any) {
      showToast('Failed to update status', 'error');
    }
  };

  // Toggle User Role
  const handleToggleUserRole = async (userId: number, currentRole: string) => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await api.put(`/admin/users/${userId}/role`, { role: nextRole });
      if (res.data.success) {
        showToast(`User role toggled to ${nextRole}`, 'success');
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
      }
    } catch (err: any) {
      showToast('Failed to update role', 'error');
    }
  };

  return (
    <div className="site-wrapper" style={{ margin: '36px auto 80px' }} id="admin-dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
            Administrative Console
          </span>
          <h1 style={{ fontSize: '28px', margin: 0 }}>Store Management Hub</h1>
        </div>

        <button
          onClick={loadAdminData}
          className="btn btn-secondary btn-sm"
          id="refresh-admin-btn"
        >
          <RotateCcw size={14} /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '28px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            padding: '12px 18px',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: activeTab === 'analytics' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'analytics' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          id="admin-tab-analytics"
        >
          <DollarSign size={16} /> Overview Analytics
        </button>

        <button
          onClick={() => setActiveTab('products')}
          style={{
            padding: '12px 18px',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: activeTab === 'products' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'products' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          id="admin-tab-products"
        >
          <Package size={16} /> Products ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '12px 18px',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: activeTab === 'orders' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          id="admin-tab-orders"
        >
          <ShoppingBag size={16} /> Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 18px',
            fontWeight: 700,
            fontSize: '14px',
            borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : 'none',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          id="admin-tab-users"
        >
          <Users size={16} /> Users ({users.length})
        </button>
      </div>

      {/* Tab 1: Overview Analytics */}
      {activeTab === 'analytics' && (
        <div>
          {/* Stat Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="card" style={{ padding: '24px' }} id="admin-stat-revenue">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Revenue</span>
                <div style={{ padding: '8px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px' }}>
                  <DollarSign size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800 }}>${Number(stats.totalRevenue || 0).toFixed(2)}</div>
              <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px', fontWeight: 600 }}>Stripe & Razorpay Captured</div>
            </div>

            <div className="card" style={{ padding: '24px' }} id="admin-stat-orders">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Orders</span>
                <div style={{ padding: '8px', background: '#ecfdf5', color: '#10b981', borderRadius: '8px' }}>
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalOrders || 0}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Across all categories</div>
            </div>

            <div className="card" style={{ padding: '24px' }} id="admin-stat-products">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Catalog</span>
                <div style={{ padding: '8px', background: '#f5f3ff', color: '#8b5cf6', borderRadius: '8px' }}>
                  <Package size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalProducts || 0}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>SKUs currently in stock</div>
            </div>

            <div className="card" style={{ padding: '24px' }} id="admin-stat-users">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Registered Users</span>
                <div style={{ padding: '8px', background: '#fef3c7', color: '#d97706', borderRadius: '8px' }}>
                  <Users size={20} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800 }}>{stats.totalUsers || 0}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Authenticated accounts</div>
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Recent Store Purchases</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Order #</th>
                    <th style={{ padding: '10px' }}>Customer</th>
                    <th style={{ padding: '10px' }}>Amount</th>
                    <th style={{ padding: '10px' }}>Payment</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 5).map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>#{o.order_number}</td>
                      <td style={{ padding: '12px 10px' }}>{o.user_name || o.shipping_name || 'Customer'}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>${Number(o.total_amount).toFixed(2)}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                          {o.payment_status} ({o.payment_method})
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textTransform: 'capitalize' }}>{o.order_status}</td>
                      <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>
                        {new Date(o.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Product Management */}
      {activeTab === 'products' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px' }}>Inventory & Product Catalog</h2>
            <button
              onClick={() => {
                setEditingProductId(null);
                setProductForm({
                  name: '',
                  description: '',
                  price: '',
                  discount_price: '',
                  stock: '',
                  brand: '',
                  category_id: 1,
                  product_image: '',
                });
                setShowProductModal(true);
              }}
              className="btn btn-primary btn-sm"
              id="admin-add-product-btn"
            >
              <Plus size={16} /> Add New Product
            </button>
          </div>

          {/* Product Modal */}
          {showProductModal && (
            <div className="card" style={{ padding: '24px', marginBottom: '32px', background: 'var(--bg-surface)' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>
                {editingProductId ? 'Edit Product' : 'Create New Product'}
              </h3>
              <form onSubmit={handleSaveProduct}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      id="product-name-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Brand *</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={productForm.brand}
                      onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                      id="product-brand-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      required
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                      id="product-price-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Discount Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      placeholder="Optional"
                      value={productForm.discount_price}
                      onChange={(e) => setProductForm({ ...productForm, discount_price: e.target.value })}
                      id="product-discount-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Stock Quantity *</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      value={productForm.stock}
                      onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                      id="product-stock-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-control"
                      value={productForm.category_id}
                      onChange={(e) => setProductForm({ ...productForm, category_id: Number(e.target.value) })}
                      id="product-category-input"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Image URL</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://..."
                    value={productForm.product_image}
                    onChange={(e) => setProductForm({ ...productForm, product_image: e.target.value })}
                    id="product-image-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    id="product-desc-input"
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" id="save-product-submit-btn">
                    {editingProductId ? 'Update Product' : 'Save Product'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductModal(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products Table */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px' }}>Product</th>
                    <th style={{ padding: '10px' }}>Brand</th>
                    <th style={{ padding: '10px' }}>Price</th>
                    <th style={{ padding: '10px' }}>Stock</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={p.product_image}
                          alt={p.name}
                          style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                        />
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>{p.brand}</td>
                      <td style={{ padding: '12px 10px', fontWeight: 700 }}>
                        ${Number(p.discount_price || p.price).toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {p.stock <= 5 ? (
                          <span className="badge badge-danger">Low: {p.stock}</span>
                        ) : (
                          <span className="badge badge-success">{p.stock} in stock</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleEditProductClick(p)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px' }}
                            title="Edit Product"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: 'var(--danger)' }}
                            title="Delete Product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Order Management */}
      {activeTab === 'orders' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Customer Orders Lifecycle</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>Order #</th>
                  <th style={{ padding: '10px' }}>Customer</th>
                  <th style={{ padding: '10px' }}>Items</th>
                  <th style={{ padding: '10px' }}>Total Amount</th>
                  <th style={{ padding: '10px' }}>Payment</th>
                  <th style={{ padding: '10px' }}>Current Status</th>
                  <th style={{ padding: '10px' }}>Change Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 700 }}>#{o.order_number}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{o.user_name || o.shipping_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.user_email}</div>
                    </td>
                    <td style={{ padding: '12px 10px' }}>{o.total_items} item(s)</td>
                    <td style={{ padding: '12px 10px', fontWeight: 800 }}>${Number(o.total_amount).toFixed(2)}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className={`badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {o.payment_status} ({o.payment_method})
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textTransform: 'capitalize', fontWeight: 600 }}>
                      {o.order_status}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <select
                        className="form-control"
                        style={{ padding: '4px 8px', fontSize: '12px', width: 'auto' }}
                        value={o.order_status}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                        id={`order-status-select-${o.id}`}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: User Management */}
      {activeTab === 'users' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>User Accounts & Roles</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px' }}>User</th>
                  <th style={{ padding: '10px' }}>Email</th>
                  <th style={{ padding: '10px' }}>Email Verified</th>
                  <th style={{ padding: '10px' }}>Role</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Toggle Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>{u.full_name}</td>
                    <td style={{ padding: '12px 10px' }}>{u.email}</td>
                    <td style={{ padding: '12px 10px' }}>
                      {u.email_verified ? (
                        <span className="badge badge-success">Verified</span>
                      ) : (
                        <span className="badge badge-warning">Unverified</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-neutral'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleToggleUserRole(u.id, u.role)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                      >
                        Make {u.role === 'admin' ? 'User' : 'Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
