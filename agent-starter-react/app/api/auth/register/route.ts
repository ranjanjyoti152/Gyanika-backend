import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateOTP, sendOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, full_name, exam_target } = body;

    // Validate required fields
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await query('SELECT id, is_verified FROM users WHERE email = $1 OR username = $2', [
      email.toLowerCase(),
      username.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      // If user exists but not verified, allow re-registration with new OTP
      if (!existingUser.rows[0].is_verified) {
        // Update existing user's info and send new OTP
        await query(
          `UPDATE users SET password_hash = crypt($1, gen_salt('bf', 10)), full_name = $2, exam_target = $3
           WHERE email = $4`,
          [password, full_name || username, exam_target || 'General', email.toLowerCase()]
        );
      } else {
        return NextResponse.json(
          { error: 'User with this email or username already exists' },
          { status: 409 }
        );
      }
    } else {
      // Create new user with is_verified = FALSE
      await query(
        `INSERT INTO users (email, username, password_hash, full_name, exam_target, is_verified)
         VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4, $5, FALSE)`,
        [
          email.toLowerCase(),
          username.toLowerCase(),
          password,
          full_name || username,
          exam_target || 'General',
        ]
      );
    }

    // Invalidate any existing OTPs for this email
    await query(
      'UPDATE email_otp_tokens SET used = TRUE WHERE email = $1 AND used = FALSE',
      [email.toLowerCase()]
    );

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    await query(
      `INSERT INTO email_otp_tokens (email, otp_code, expires_at)
       VALUES ($1, $2, $3)`,
      [email.toLowerCase(), otp, expiresAt]
    );

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp);
    if (!emailResult.success) {
      console.error('Failed to send OTP email:', emailResult.error);
      // Still return success but warn about email issue
      return NextResponse.json({
        success: true,
        requiresOtp: true,
        message: 'Account created. Please check your email for verification code.',
        email: email.toLowerCase(),
        expiresAt: expiresAt.toISOString(),
        warning: 'Email sending may have failed. Please use resend OTP if you don\'t receive the code.',
      });
    }

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      message: 'Account created. Please check your email for verification code.',
      email: email.toLowerCase(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
