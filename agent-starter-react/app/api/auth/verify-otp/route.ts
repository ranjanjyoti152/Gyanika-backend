import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, otp } = body;

        // Validate required fields
        if (!email || !otp) {
            return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
        }

        // Validate OTP format (6 digits)
        if (!/^\d{6}$/.test(otp)) {
            return NextResponse.json({ error: 'Invalid OTP format' }, { status: 400 });
        }

        // Find valid OTP
        const otpResult = await query(
            `SELECT id FROM email_otp_tokens 
       WHERE email = $1 
       AND otp_code = $2 
       AND expires_at > NOW() 
       AND used = FALSE`,
            [email.toLowerCase(), otp]
        );

        if (otpResult.rows.length === 0) {
            return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
        }

        // Mark OTP as used
        await query('UPDATE email_otp_tokens SET used = TRUE WHERE id = $1', [otpResult.rows[0].id]);

        // Mark user as verified
        const userResult = await query(
            `UPDATE users SET is_verified = TRUE 
       WHERE email = $1 
       RETURNING id, email, username, full_name, exam_target`,
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const user = userResult.rows[0];

        // Generate session token
        const sessionToken = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Create session
        await query(
            `INSERT INTO sessions (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
            [user.id, sessionToken, expiresAt]
        );

        return NextResponse.json({
            success: true,
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                exam_target: user.exam_target,
            },
            token: sessionToken,
            expiresAt: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error('OTP verification error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
