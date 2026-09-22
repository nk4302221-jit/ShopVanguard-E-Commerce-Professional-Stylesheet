import nodemailer from 'nodemailer';

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass },
    });
  } else {
    // Generate test ethereal account if no live credentials
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('[EmailService] Using Ethereal test mailer for verification emails');
    } catch (e) {
      console.warn('[EmailService] Could not connect to Ethereal, will simulate mail delivery:', e.message);
      transporter = {
        sendMail: async (opts) => {
          console.log('[SIMULATED EMAIL SENT]:', opts.to, opts.subject, opts.text);
          return { messageId: 'simulated_' + Date.now() };
        }
      };
    }
  }

  return transporter;
}

export async function sendVerificationEmail(toEmail, fullName, verificationToken) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const verifyLink = `${clientUrl}/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"ShopVanguard" <noreply@shopvanguard.com>',
    to: toEmail,
    subject: 'Verify your ShopVanguard Account Email',
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">Welcome to ShopVanguard, ${fullName}!</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6;">
          Thank you for signing up. Please verify your email address to activate your account and start shopping.
        </p>
        <div style="margin: 28px 0;">
          <a href="${verifyLink}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: 600; border-radius: 8px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #64748b; font-size: 14px;">
          Or copy and paste this link in your browser: <br/>
          <a href="${verifyLink}" style="color: #2563eb;">${verifyLink}</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          This link will expire in 24 hours. If you did not create this account, please ignore this email.
        </p>
      </div>
    `,
    text: `Welcome to ShopVanguard! Please verify your email address by visiting: ${verifyLink}`,
  };

  try {
    const transport = await getTransporter();
    const info = await transport.sendMail(mailOptions);
    console.log(`[EmailService] Verification email sent to ${toEmail}. Preview URL: ${nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : 'N/A'}`);
    return { success: true, previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null, verifyLink };
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return { success: false, error: error.message, verifyLink };
  }
}
