import { errorResponse } from '../utils/responseHelper.js';

export function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(res, 'Access forbidden. Administrator privileges required.', 403);
  }
  next;
  next();
}
