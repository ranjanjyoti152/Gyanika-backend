import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateOTP, sendOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email } = body;

        // Validate required fields
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        // Check if user exists and is not verified
        const userResult = await query(
            'SELECT id, is_verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (userResult.rows[0].is_verified) {
            return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
        }

        // Invalidate any existing OTPs for this email
        await query(
            'UPDATE email_otp_tokens SET used = TRUE WHERE email = $1 AND used = FALSE',
            [email.toLowerCase()]
        );

        // Generate new OTP
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
            return NextResponse.json(
                { error: emailResult.error || 'Failed to send OTP email' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully',
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error('Resend OTP error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
