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
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        </head>
        <body style="margin: 0; padding: 10px; background-color: #0f172a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
            <tr>
              <td style="background-color: #020617; border-radius: 16px; border: 2px solid #0e7490; padding: 25px 20px;">
                
                <!-- Header -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="text-align: center; padding-bottom: 25px;">
                      <div style="font-size: 50px;">🎓</div>
                      <h1 style="color: #22d3ee; margin: 10px 0 5px 0; font-size: 26px;">Gyanika</h1>
                      <p style="color: #67e8f9; margin: 0; font-size: 13px;">Your AI Learning Assistant</p>
                    </td>
                  </tr>
                </table>

                <!-- OTP Box -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="background-color: #0c4a6e; border: 2px solid #0891b2; border-radius: 12px; padding: 25px 15px; text-align: center;">
                      <p style="color: #e0f2fe; font-size: 16px; margin: 0 0 20px 0;">Your verification code is:</p>
                      <div style="background: linear-gradient(135deg, #0891b2 0%, #0284c7 100%); padding: 18px 25px; border-radius: 10px; display: inline-block;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">` + otp + `</span>
                      </div>
                      <p style="color: #7dd3fc; font-size: 13px; margin: 20px 0 0 0;">⏱️ Expires in 10 minutes</p>
                    </td>
                  </tr>
                </table>

                <!-- Info -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
                  <tr>
                    <td style="background-color: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 15px;">
                      <p style="color: #cbd5e1; margin: 0; font-size: 13px; line-height: 1.6; text-align: center;">
                        Enter this code to verify your email and start learning with Gyanika!
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px; border-top: 1px solid #1e293b; padding-top: 15px;">
                  <tr>
                    <td style="text-align: center;">
                      <p style="color: #64748b; font-size: 11px; margin: 0 0 8px 0;">If you didn't request this, ignore this email.</p>
                      <p style="color: #22d3ee; font-size: 11px; margin: 0;">© ` + new Date().getFullYear() + ` Gyanika 🎯</p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>
          </table>
        </body>
        </html>
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
