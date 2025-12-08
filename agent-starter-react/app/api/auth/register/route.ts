import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@/lib/db';

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
    const existingUser = await query('SELECT id FROM users WHERE email = $1 OR username = $2', [
      email.toLowerCase(),
      username.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 409 }
      );
    }

    // Create new user with hashed password
    const result = await query(
      `INSERT INTO users (email, username, password_hash, full_name, exam_target, is_verified)
       VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4, $5, TRUE)
       RETURNING id, email, username, full_name, exam_target, created_at`,
      [
        email.toLowerCase(),
        username.toLowerCase(),
        password,
        full_name || username,
        exam_target || 'General',
      ]
    );

    const user = result.rows[0];

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
      message: 'User registered successfully',
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
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
