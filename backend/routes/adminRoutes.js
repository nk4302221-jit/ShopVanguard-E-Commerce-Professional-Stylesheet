import express from 'express';
import {
  getDashboardStats,
  getUsers,
  updateUserStatus,
  getUserDetails,
  getAdminOrders,
  updateOrderStatus,
} from '../controllers/adminController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorizeAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.use(authenticate, authorizeAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.patch('/users/:id/status', updateUserStatus);
router.get('/orders', getAdminOrders);
router.patch('/orders/:id/status', updateOrderStatus);

export default router;
