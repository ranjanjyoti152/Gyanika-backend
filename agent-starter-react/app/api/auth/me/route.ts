import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    // Find valid session and user
    const result = await query(
      `SELECT u.id, u.email, u.username, u.full_name, u.exam_target, 
              u.preferred_language, u.avatar_url, u.created_at
       FROM users u
       INNER JOIN sessions s ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const user = result.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        exam_target: user.exam_target,
        preferred_language: user.preferred_language,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
