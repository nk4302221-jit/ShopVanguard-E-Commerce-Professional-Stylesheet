import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance = null;

function getRazorpayInstance() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret || keyId === 'rzp_test_example123456') {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayInstance;
}

/**
 * Creates a Razorpay Order
 * @param {Object} options
 * @param {number} options.amount - In main currency units (e.g. INR or USD)
 * @param {string} options.currency - ISO code (e.g. 'INR', 'USD')
 * @param {string} options.receipt - Unique order/receipt ID
 * @param {Object} options.notes - Optional metadata notes
 */
export async function createRazorpayOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  try {
    const rzp = getRazorpayInstance();
    const amountInSubunits = Math.round(Number(amount) * 100); // 1 INR/USD = 100 subunits (paise/cents)

    if (rzp) {
      const order = await rzp.orders.create({
        amount: amountInSubunits,
        currency,
        receipt: String(receipt),
        notes,
      });

      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        isSandboxMock: false,
      };
    }

    // High-fidelity sandbox/test simulation mode when real keys are pending
    console.log('[Razorpay Service] Using Sandbox Simulation Mode for receipt:', receipt);
    const mockOrderId = `order_rzp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      id: mockOrderId,
      amount: amountInSubunits,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_shopvanguard',
      isSandboxMock: true,
    };
  } catch (error) {
    console.error('[Razorpay Service Error]: Failed to create order:', error);
    throw error;
  }
}

/**
 * Verifies Razorpay payment signature
 * @param {Object} data
 * @param {string} data.orderId
 * @param {string} data.paymentId
 * @param {string} data.signature
 */
export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret || keySecret === 'your_razorpay_secret_key') {
    // Sandbox simulation passes valid mock format
    return Boolean(orderId && paymentId);
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  } catch (error) {
    console.error('[Razorpay Signature Error]:', error);
    return false;
  }
}

export default {
  createRazorpayOrder,
  verifyRazorpaySignature,
};
