import { executeQuery } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export async function getDashboardStats(req, res) {
  try {
    const totalUsersResult = await executeQuery('SELECT COUNT(*) as count FROM users');
    const totalProductsResult = await executeQuery('SELECT COUNT(*) as count FROM products');
    const totalOrdersResult = await executeQuery('SELECT COUNT(*) as count FROM orders');
    const totalRevenueResult = await executeQuery("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE payment_status = 'paid'");

    const activeMembershipsResult = await executeQuery("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND expiry_time > CURRENT_TIMESTAMP");
    const expiredMembershipsResult = await executeQuery("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'expired' OR expiry_time <= CURRENT_TIMESTAMP");

    // Recent orders
    const recentOrders = await executeQuery(
      `SELECT o.*, u.full_name as customer_name, u.email as customer_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.created_at DESC LIMIT 6`
    );

    // Category distribution
    const categoryStats = await executeQuery(
      `SELECT category_name, COUNT(*) as product_count, AVG(price) as avg_price
       FROM products
       GROUP BY category_name`
    );

    return successResponse(res, 'Admin dashboard statistics', {
      stats: {
        totalUsers: totalUsersResult[0].count,
        totalProducts: totalProductsResult[0].count,
        totalOrders: totalOrdersResult[0].count,
        totalRevenue: Number(totalRevenueResult[0].total.toFixed(2)),
        activeMemberships: activeMembershipsResult[0].count,
        expiredMemberships: expiredMembershipsResult[0].count,
      },
      recentOrders,
      categoryStats,
    });
  } catch (error) {
    console.error('GetDashboardStats Error:', error);
    return errorResponse(res, 'Failed to fetch dashboard statistics', 500);
  }
}

export async function getUsers(req, res) {
  try {
    const {
      search,
      role,
      status,
      emailVerified,
      membership,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Search by name, email, or phone
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      params.push(term, term, term);
    }

    // Filter by role
    if (role && role !== 'all') {
      conditions.push('u.role = ?');
      params.push(role);
    }

    // Filter by account status (active, inactive, suspended)
    if (status && status !== 'all') {
      conditions.push('u.status = ?');
      params.push(status);
    }

    // Filter by email verification
    if (emailVerified !== undefined && emailVerified !== 'all') {
      conditions.push('u.email_verified = ?');
      params.push(emailVerified === 'true' || emailVerified === '1' ? 1 : 0);
    }

    // Filter by membership
    if (membership && membership !== 'all') {
      if (membership === 'none') {
        conditions.push('(s.id IS NULL OR s.status != "active" OR s.expiry_time <= CURRENT_TIMESTAMP)');
      } else {
        conditions.push('p.slug = ? AND s.status = "active" AND s.expiry_time > CURRENT_TIMESTAMP');
        params.push(membership);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count for SQL pagination
    const countSql = `
      SELECT COUNT(DISTINCT u.id) as total 
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      ${whereClause}
    `;
    const countResult = await executeQuery(countSql, params);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    // Users list query
    const dataSql = `
      SELECT u.id, u.full_name as name, u.email, u.phone, u.role, u.status, u.email_verified,
             u.avatar_url, u.created_at,
             p.name as membership_plan, s.expiry_time as membership_expiry, s.status as membership_status,
             (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
      LEFT JOIN plans p ON p.id = s.plan_id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const users = await executeQuery(dataSql, [...params, limitNum, offset]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Admin GetUsers Error:', error);
    return errorResponse(res, 'Failed to fetch users', 500);
  }
}

export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, role } = req.body;

    // Prevent admin from deactivating themselves
    if (parseInt(id, 10) === req.user.id && status && status !== 'active') {
      return errorResponse(res, 'You cannot deactivate your own administrative account', 400);
    }

    await executeQuery(
      `UPDATE users SET 
         status = COALESCE(?, status),
         role = COALESCE(?, role),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, role, id]
    );

    const updatedUser = (await executeQuery('SELECT * FROM users WHERE id = ?', [id]))[0];
    return successResponse(res, 'User updated successfully', { user: updatedUser });
  } catch (error) {
    console.error('UpdateUserStatus Error:', error);
    return errorResponse(res, 'Failed to update user', 500);
  }
}

export async function getUserDetails(req, res) {
  try {
    const { id } = req.params;

    const users = await executeQuery('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    const user = users[0];
    const orders = await executeQuery('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [id]);
    const subscriptions = await executeQuery(
      `SELECT s.*, p.name as plan_name 
       FROM subscriptions s 
       JOIN plans p ON p.id = s.plan_id 
       WHERE s.user_id = ? 
       ORDER BY s.created_at DESC`,
      [id]
    );
    const addresses = await executeQuery('SELECT * FROM addresses WHERE user_id = ?', [id]);

    return successResponse(res, 'User details retrieved', {
      user,
      orders,
      subscriptions,
      addresses,
    });
  } catch (error) {
    console.error('GetUserDetails Error:', error);
    return errorResponse(res, 'Failed to fetch user details', 500);
  }
}

export async function getAdminOrders(req, res) {
  try {
    const { search, status, paymentStatus, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR CAST(o.id AS TEXT) LIKE ?)');
      params.push(term, term, term);
    }

    if (status && status !== 'all') {
      conditions.push('o.order_status = ?');
      params.push(status);
    }

    if (paymentStatus && paymentStatus !== 'all') {
      conditions.push('o.payment_status = ?');
      params.push(paymentStatus);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as total 
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereClause}
    `;
    const countResult = await executeQuery(countSql, params);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    const ordersSql = `
      SELECT o.*, u.full_name as customer_name, u.email as customer_email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN users u ON u.id = o.user_id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const orders = await executeQuery(ordersSql, [...params, limitNum, offset]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('GetAdminOrders Error:', error);
    return errorResponse(res, 'Failed to fetch admin orders', 500);
  }
}

export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { orderStatus, paymentStatus } = req.body;

    const validOrderStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (orderStatus && !validOrderStatuses.includes(orderStatus)) {
      return errorResponse(res, 'Invalid order status', 400);
    }

    await executeQuery(
      `UPDATE orders SET
         order_status = COALESCE(?, order_status),
         payment_status = COALESCE(?, payment_status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [orderStatus, paymentStatus, id]
    );

    const updated = (await executeQuery('SELECT * FROM orders WHERE id = ?', [id]))[0];
    return successResponse(res, 'Order status updated', { order: updated });
  } catch (error) {
    console.error('UpdateOrderStatus Error:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
}
