import express from 'express';
import {
  register,
  login,
  verifyEmail,
  socialLogin,
  getMe,
  resendVerification,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-email/:token', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/google', socialLogin);
router.post('/facebook', socialLogin);
router.get('/me', authenticate, getMe);

export default router;
