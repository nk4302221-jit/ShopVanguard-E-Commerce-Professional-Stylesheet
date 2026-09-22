import { verifyToken } from '../utils/jwtHelper.js';
import { executeQuery } from '../config/db.js';
import { errorResponse } from '../utils/responseHelper.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication token missing or invalid format', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.id) {
      return errorResponse(res, 'Token has expired or is invalid', 401);
    }

    const users = await executeQuery('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!users || users.length === 0) {
      return errorResponse(res, 'User account no longer exists', 401);
    }

    const user = users[0];
    if (user.status !== 'active') {
      return errorResponse(res, `Account is ${user.status}. Please contact support.`, 403);
    }

    // Require email verification for protected features
    if (!user.email_verified) {
      return errorResponse(res, 'Please verify your email address to access this feature.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return errorResponse(res, 'Authentication verification failed', 500);
  }
}
