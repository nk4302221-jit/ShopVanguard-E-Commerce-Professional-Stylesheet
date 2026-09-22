import { executeQuery } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';
import { createCheckoutSession } from '../services/stripeService.js';
import { createRazorpayOrder, verifyRazorpaySignature } from '../services/razorpayService.js';

export async function createOrder(req, res) {
  try {
    const userId = req.user.id;
    const { addressId } = req.body;

    if (!addressId) {
      return errorResponse(res, 'Please select a delivery address for the order', 400);
    }

    // Verify address belongs to user
    const addresses = await executeQuery('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [addressId, userId]);
    if (addresses.length === 0) {
      return errorResponse(res, 'Selected delivery address does not exist', 404);
    }

    // Get cart items
    const carts = await executeQuery('SELECT id FROM cart WHERE user_id = ?', [userId]);
    if (carts.length === 0) {
      return errorResponse(res, 'Cart is empty', 400);
    }

    const cartId = carts[0].id;
    const cartItems = await executeQuery(
      `SELECT ci.quantity, p.id as product_id, p.name, p.price, p.discount_price, p.stock, p.product_image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?`,
      [cartId]
    );

    if (cartItems.length === 0) {
      return errorResponse(res, 'Your cart is empty. Please add products before checking out.', 400);
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return errorResponse(
          res,
          `Insufficient stock for "${item.name}". Requested: ${item.quantity}, Available: ${item.stock}`,
          400
        );
      }
    }

    // Check membership discounts
    const userRows = await executeQuery('SELECT active_plan_id FROM users WHERE id = ?', [userId]);
    const activePlanId = userRows[0]?.active_plan_id || null;

    let subtotal = 0;
    let regularDiscount = 0;
    for (const item of cartItems) {
      const p = Number(item.price);
      const disc = item.discount_price ? p - Number(item.discount_price) : 0;
      subtotal += p * item.quantity;
      regularDiscount += Math.max(0, disc) * item.quantity;
    }

    let membershipDiscount = 0;
    let shipping = subtotal > 100 || subtotal === 0 ? 0.00 : 15.00;
    if (activePlanId === 2) {
      membershipDiscount = (subtotal - regularDiscount) * 0.05;
    } else if (activePlanId === 3) {
      membershipDiscount = (subtotal - regularDiscount) * 0.12;
      shipping = 0.00;
    }

    const discount = Number((regularDiscount + membershipDiscount).toFixed(2));
    const totalAmount = Number((subtotal - discount + shipping).toFixed(2));

    // Create Order Record in pending state
    const orderResult = await executeQuery(
      `INSERT INTO orders 
       (user_id, address_id, subtotal, discount, shipping, total_amount, payment_status, order_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [userId, addressId, subtotal, discount, shipping, totalAmount]
    );

    const orderId = orderResult.insertId;

    // Snapshot current product price at order creation!
    for (const item of cartItems) {
      const unitPrice = item.discount_price ? Number(item.discount_price) : Number(item.price);
      const itemTotal = Number((unitPrice * item.quantity).toFixed(2));

      await executeQuery(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, total, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.name, item.quantity, unitPrice, itemTotal, item.product_image]
      );
    }

    return successResponse(
      res,
      'Order initiated successfully. Proceed to payment.',
      {
        orderId,
        totalAmount,
      },
      201
    );
  } catch (error) {
    console.error('CreateOrder Error:', error);
    return errorResponse(res, 'Failed to create order', 500);
  }
}

export async function createCheckoutSessionHandler(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return errorResponse(res, 'Order ID is required to initiate Stripe checkout', 400);
    }

    const orders = await executeQuery('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    if (order.payment_status === 'paid') {
      return errorResponse(res, 'This order has already been paid for.', 400);
    }

    const items = await executeQuery('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const session = await createCheckoutSession({
      orderId,
      items,
      customerEmail: req.user.email,
      successUrl: `${clientUrl}/orders/${orderId}`,
      cancelUrl: `${clientUrl}/checkout`,
      totalAmount: order.total_amount,
    });

    // Save Stripe session ID in orders table
    await executeQuery(
      'UPDATE orders SET stripe_session_id = ? WHERE id = ?',
      [session.id, orderId]
    );

    return successResponse(res, 'Checkout session created', {
      sessionId: session.id,
      checkoutUrl: session.url,
      isSandboxMock: session.isSandboxMock,
    });
  } catch (error) {
    console.error('CreateCheckoutSession Error:', error);
    return errorResponse(res, 'Failed to create checkout session', 500);
  }
}

export async function confirmOrderPayment(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { paymentIntentId, sessionId } = req.body;

    const orders = await executeQuery('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId]);
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    if (order.payment_status === 'paid') {
      return successResponse(res, 'Order is already confirmed and paid', { order });
    }

    // Deduct stock for all order items
    const items = await executeQuery('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]);
    for (const item of items) {
      await executeQuery(
        'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Update order status to confirmed & payment to paid
    const transactionId = paymentIntentId || sessionId || `txn_stripe_${Date.now()}`;
    await executeQuery(
      `UPDATE orders 
       SET payment_status = 'paid', order_status = 'confirmed', stripe_payment_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [transactionId, id]
    );

    // Record in payments table
    await executeQuery(
      `INSERT INTO payments (order_id, user_id, amount, currency, provider, payment_intent_id, status)
       VALUES (?, ?, ?, 'USD', 'stripe', ?, 'succeeded')`,
      [id, userId, order.total_amount, transactionId]
    );

    // Clear user's cart now that order is confirmed
    const carts = await executeQuery('SELECT id FROM cart WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
      await executeQuery('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    const updatedOrder = (await executeQuery('SELECT * FROM orders WHERE id = ?', [id]))[0];
    return successResponse(res, 'Payment verified successfully and order confirmed!', { order: updatedOrder });
  } catch (error) {
    console.error('ConfirmOrderPayment Error:', error);
    return errorResponse(res, 'Failed to confirm order payment', 500);
  }
}

export async function createRazorpayOrderHandler(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return errorResponse(res, 'Order ID is required to initiate Razorpay checkout', 400);
    }

    const orders = await executeQuery('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    if (order.payment_status === 'paid') {
      return errorResponse(res, 'This order is already paid.', 400);
    }

    const razorpayOrder = await createRazorpayOrder({
      amount: order.total_amount,
      currency: 'INR',
      receipt: `order_rcpt_${orderId}`,
      notes: {
        orderId: String(orderId),
        userId: String(userId),
        customerEmail: req.user.email,
      },
    });

    // Update razorpay order id in orders table
    await executeQuery('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [razorpayOrder.id, orderId]);

    return successResponse(res, 'Razorpay order created successfully', {
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: razorpayOrder.keyId,
      isSandboxMock: razorpayOrder.isSandboxMock,
    });
  } catch (error) {
    console.error('CreateRazorpayOrder Error:', error);
    return errorResponse(res, 'Failed to initiate Razorpay payment', 500);
  }
}

export async function verifyRazorpayPaymentHandler(req, res) {
  try {
    const userId = req.user.id;
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!orderId || !razorpayPaymentId) {
      return errorResponse(res, 'Order ID and Razorpay Payment ID are required', 400);
    }

    const orders = await executeQuery('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, userId]);
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    if (order.payment_status === 'paid') {
      return successResponse(res, 'Order is already marked as paid', { order });
    }

    // Verify cryptographic signature
    const isValid = verifyRazorpaySignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });

    if (!isValid) {
      return errorResponse(res, 'Invalid Razorpay payment signature verification failed', 400);
    }

    // Deduct stock for all order items
    const items = await executeQuery('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await executeQuery(
        'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Update order status to confirmed and payment status to paid
    await executeQuery(
      `UPDATE orders 
       SET payment_status = 'paid', order_status = 'confirmed', stripe_payment_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [razorpayPaymentId, orderId]
    );

    // Record in payments table
    await executeQuery(
      `INSERT INTO payments (order_id, user_id, amount, currency, provider, payment_intent_id, status)
       VALUES (?, ?, ?, 'INR', 'razorpay', ?, 'succeeded')`,
      [orderId, userId, order.total_amount, razorpayPaymentId]
    );

    // Clear user's shopping cart
    const carts = await executeQuery('SELECT id FROM cart WHERE user_id = ?', [userId]);
    if (carts.length > 0) {
      await executeQuery('DELETE FROM cart_items WHERE cart_id = ?', [carts[0].id]);
    }

    const updatedOrder = (await executeQuery('SELECT * FROM orders WHERE id = ?', [orderId]))[0];
    return successResponse(res, 'Razorpay payment verified successfully and order confirmed!', { order: updatedOrder });
  } catch (error) {
    console.error('VerifyRazorpayPayment Error:', error);
    return errorResponse(res, 'Failed to verify Razorpay payment', 500);
  }
}

export async function getUserOrders(req, res) {
  try {
    const userId = req.user.id;
    const orders = await executeQuery(
      `SELECT o.*, 
              a.full_name as shipping_name, a.address_line1, a.city, a.state, a.postal_code,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as total_items
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    );

    return successResponse(res, 'Orders retrieved', { orders });
  } catch (error) {
    console.error('GetUserOrders Error:', error);
    return errorResponse(res, 'Failed to fetch orders', 500);
  }
}

export async function getOrderById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const orders = await executeQuery(
      `SELECT o.*, 
              a.full_name as shipping_name, a.phone as shipping_phone,
              a.address_line1, a.address_line2, a.city, a.state, a.country, a.postal_code
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.id = ? AND (o.user_id = ? OR ? = 'admin')`,
      [id, userId, req.user.role]
    );

    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    const items = await executeQuery('SELECT * FROM order_items WHERE order_id = ?', [id]);

    return successResponse(res, 'Order details retrieved', {
      order: {
        ...order,
        items,
      },
    });
  } catch (error) {
    console.error('GetOrderById Error:', error);
    return errorResponse(res, 'Failed to fetch order details', 500);
  }
}
