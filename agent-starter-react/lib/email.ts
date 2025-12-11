import * as nodemailer from 'nodemailer';

// Email transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Generate a random 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP email
export async function sendOTPEmail(
  to: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('Gmail credentials not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const mailOptions = {
      from: `"Gyanika" <${process.env.GMAIL_USER}>`,
      to,
      subject: '🎓 Verify Your Gyanika Account',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #020617; border-radius: 20px; border: 2px solid #0e7490;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="font-size: 56px; margin-bottom: 10px;">🎓</div>
            <h1 style="color: #22d3ee; margin: 0; font-size: 32px; text-shadow: 0 0 20px rgba(34, 211, 238, 0.5);">Gyanika</h1>
            <p style="color: #67e8f9; margin-top: 8px; font-size: 14px;">Your AI Learning Assistant</p>
          </div>
          
          <div style="background-color: #0c4a6e; border: 2px solid #0891b2; padding: 35px; border-radius: 16px; text-align: center; margin-bottom: 25px;">
            <p style="color: #e0f2fe; font-size: 18px; margin: 0 0 25px 0; font-weight: 500;">Your verification code is:</p>
            <div style="background: linear-gradient(135deg, #0891b2 0%, #0284c7 100%); padding: 25px 50px; border-radius: 12px; display: inline-block; box-shadow: 0 8px 30px rgba(8, 145, 178, 0.6);">
              <span style="font-size: 48px; font-weight: bold; letter-spacing: 14px; color: #ffffff;">` + otp + `</span>
            </div>
            <p style="color: #7dd3fc; font-size: 14px; margin-top: 25px;">⏱️ This code expires in 10 minutes</p>
          </div>
          
          <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
            <p style="color: #e2e8f0; margin: 0; font-size: 14px; line-height: 1.7; text-align: center;">
              Enter this code on the verification page to complete your registration and start your learning journey with Gyanika!
            </p>
          </div>
          
          <div style="text-align: center; padding-top: 15px; border-top: 1px solid #1e293b;">
            <p style="color: #94a3b8; font-size: 12px; margin: 10px 0;">If you didn't request this code, please ignore this email.</p>
            <p style="color: #22d3ee; font-size: 12px; margin: 0;">© ` + new Date().getFullYear() + ` Gyanika - Knowledge is Power 🎯</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}
