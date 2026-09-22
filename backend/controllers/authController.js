import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { executeQuery } from '../config/db.js';
import { generateToken } from '../utils/jwtHelper.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { handleSocialAuth } from '../services/oauthService.js';

export async function register(req, res) {
  try {
    const { fullName, email, password, confirmPassword, phone } = req.body;

    // 1. Validation
    if (!fullName || !email || !password || !confirmPassword) {
      return errorResponse(res, 'All required fields must be filled', 400);
    }

    if (password !== confirmPassword) {
      return errorResponse(res, 'Password and confirmation password do not match', 400);
    }

    if (password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Please provide a valid email address', 400);
    }

    // 2. Check uniqueness
    const existing = await executeQuery('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing.length > 0) {
      return errorResponse(res, 'An account with this email address already exists', 409);
    }

    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Create user in MySQL
    const userInsert = await executeQuery(
      `INSERT INTO users (full_name, email, password_hash, phone, role, email_verified, status)
       VALUES (?, ?, ?, ?, 'customer', 0, 'active')`,
      [fullName.trim(), email.toLowerCase().trim(), passwordHash, phone ? phone.trim() : null]
    );

    const userId = userInsert.insertId;

    // Create default cart and wishlist for user
    await executeQuery('INSERT INTO cart (user_id) VALUES (?)', [userId]);
    await executeQuery('INSERT INTO wishlist (user_id) VALUES (?)', [userId]);

    // 5. Generate email verification token (24-hour expiration)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    await executeQuery(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [userId, token, expiresAt]
    );

    // 6. Send verification email
    const emailResult = await sendVerificationEmail(email, fullName, token);

    return successResponse(
      res,
      'Registration successful! Please check your email to verify your account before logging in.',
      {
        userId,
        email,
        verificationToken: token, // Provided for easy development / sandbox testing
        verifyLink: emailResult.verifyLink,
      },
      201
    );
  } catch (error) {
    console.error('Registration Error:', error);
    return errorResponse(res, 'Registration failed due to a server error', 500);
  }
}

export async function verifyEmail(req, res) {
  try {
    const token = req.params.token || req.query.token || req.body.token;

    if (!token) {
      return errorResponse(res, 'Verification token is required', 400);
    }

    const tokenRecords = await executeQuery(
      'SELECT * FROM email_verification_tokens WHERE token = ?',
      [token]
    );

    if (tokenRecords.length === 0) {
      return errorResponse(res, 'Invalid verification token', 404);
    }

    const record = tokenRecords[0];

    if (record.used) {
      return errorResponse(res, 'This verification token has already been used. Please log in.', 400);
    }

    const expiryTime = new Date(record.expires_at).getTime();
    if (Date.now() > expiryTime) {
      return errorResponse(res, 'Verification token has expired. Please request a new one.', 400);
    }

    // Mark email as verified & invalidate token
    await executeQuery('UPDATE users SET email_verified = 1 WHERE id = ?', [record.user_id]);
    await executeQuery('UPDATE email_verification_tokens SET used = 1 WHERE id = ?', [record.id]);

    return successResponse(res, 'Email successfully verified! You may now log in to your account.', {
      verified: true,
    });
  } catch (error) {
    console.error('Verify Email Error:', error);
    return errorResponse(res, 'Failed to verify email', 500);
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (users.length === 0) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    const user = users[0];

    // Check account status
    if (user.status !== 'active') {
      return errorResponse(res, `Your account is ${user.status}. Please contact support.`, 403);
    }

    // Check password
    if (!user.password_hash) {
      return errorResponse(res, 'This account was created with social login. Please sign in with Google or Facebook.', 400);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    // Check email verification
    if (!user.email_verified) {
      return errorResponse(
        res,
        'Your email address is not verified yet. Please check your inbox or click resend verification link.',
        403,
        { emailVerified: false, email: user.email }
      );
    }

    // Generate JWT
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return successResponse(res, 'Login successful', {
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url,
        phone: user.phone,
        active_plan_id: user.active_plan_id,
        email_verified: Boolean(user.email_verified),
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return errorResponse(res, 'Login failed due to a server error', 500);
  }
}

export async function socialLogin(req, res) {
  try {
    const { provider, providerUserId, email, name, avatarUrl } = req.body;

    if (!provider || !email) {
      return errorResponse(res, 'Provider and email are required for social login', 400);
    }

    const result = await handleSocialAuth({
      provider,
      providerUserId: providerUserId || `social_${Date.now()}`,
      email: email.toLowerCase().trim(),
      name,
      avatarUrl,
    });

    return successResponse(res, `${provider} login successful`, result);
  } catch (error) {
    console.error('Social Login Error:', error);
    return errorResponse(res, error.message || 'Social login failed', 500);
  }
}

export async function getMe(req, res) {
  try {
    const users = await executeQuery(
      `SELECT u.id, u.full_name as name, u.email, u.phone, u.role, u.email_verified, u.avatar_url, 
              u.active_plan_id, u.status, u.created_at,
              p.name as plan_name, s.expiry_time as plan_expiry, s.status as subscription_status
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN plans p ON p.id = s.plan_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return errorResponse(res, 'User not found', 404);
    }

    const user = users[0];
    return successResponse(res, 'Profile retrieved', { user });
  } catch (error) {
    console.error('GetMe Error:', error);
    return errorResponse(res, 'Failed to retrieve user profile', 500);
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return errorResponse(res, 'Email address is required', 400);
    }

    const users = await executeQuery('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (users.length === 0) {
      return errorResponse(res, 'No account found with this email', 404);
    }

    const user = users[0];
    if (user.email_verified) {
      return successResponse(res, 'This email is already verified. You can log in directly.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    await executeQuery(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, 0)',
      [user.id, token, expiresAt]
    );

    const emailResult = await sendVerificationEmail(user.email, user.full_name, token);

    return successResponse(res, 'Verification email sent! Please check your inbox.', {
      verifyLink: emailResult.verifyLink,
    });
  } catch (error) {
    console.error('Resend Verification Error:', error);
    return errorResponse(res, 'Failed to send verification email', 500);
  }
}
