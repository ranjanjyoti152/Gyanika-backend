#!/usr/bin/env python3
"""
Gyanika Admin Panel
===================
Web-based user management panel on port 9000

Run: python admin_panel.py
Open: http://localhost:9000
"""

from flask import Flask, render_template_string, request, redirect, url_for, flash, jsonify
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'gyanika_admin_secret_key_2024'

# Database connection settings
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "gyanika_db",
    "user": "gyanika",
    "password": "gyanika_secret_2024"
}

# HTML Template
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎓 Gyanika Admin Panel</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            min-height: 100vh;
            color: #e2e8f0;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: rgba(6, 182, 212, 0.1);
            border: 1px solid rgba(6, 182, 212, 0.3);
            border-radius: 16px;
            padding: 20px 30px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        header h1 {
            color: #22d3ee;
            font-size: 1.8rem;
        }
        
        header .stats {
            display: flex;
            gap: 30px;
        }
        
        .stat-box {
            text-align: center;
            padding: 10px 20px;
            background: rgba(6, 182, 212, 0.2);
            border-radius: 10px;
        }
        
        .stat-box .number {
            font-size: 1.5rem;
            font-weight: bold;
            color: #22d3ee;
        }
        
        .stat-box .label {
            font-size: 0.8rem;
            color: #94a3b8;
        }
        
        .flash-messages {
            margin-bottom: 20px;
        }
        
        .flash {
            padding: 15px 20px;
            border-radius: 10px;
            margin-bottom: 10px;
        }
        
        .flash.success {
            background: rgba(34, 197, 94, 0.2);
            border: 1px solid rgba(34, 197, 94, 0.5);
            color: #86efac;
        }
        
        .flash.error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
        }
        
        .search-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 25px;
        }
        
        .search-bar input {
            flex: 1;
            padding: 12px 20px;
            border: 1px solid rgba(6, 182, 212, 0.3);
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.8);
            color: #e2e8f0;
            font-size: 1rem;
        }
        
        .search-bar input:focus {
            outline: none;
            border-color: #22d3ee;
        }
        
        .search-bar button {
            padding: 12px 25px;
            background: linear-gradient(135deg, #0891b2, #06b6d4);
            border: none;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .search-bar button:hover {
            transform: scale(1.02);
        }
        
        .users-table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(15, 23, 42, 0.6);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(6, 182, 212, 0.2);
        }
        
        .users-table th {
            background: rgba(6, 182, 212, 0.2);
            padding: 15px 20px;
            text-align: left;
            font-weight: 600;
            color: #22d3ee;
            border-bottom: 1px solid rgba(6, 182, 212, 0.3);
        }
        
        .users-table td {
            padding: 15px 20px;
            border-bottom: 1px solid rgba(6, 182, 212, 0.1);
        }
        
        .users-table tr:hover {
            background: rgba(6, 182, 212, 0.1);
        }
        
        .status-badge {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
        }
        
        .status-badge.active {
            background: rgba(34, 197, 94, 0.2);
            color: #86efac;
        }
        
        .status-badge.inactive {
            background: rgba(239, 68, 68, 0.2);
            color: #fca5a5;
        }
        
        .actions {
            display: flex;
            gap: 8px;
        }
        
        .btn {
            padding: 8px 15px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        
        .btn-info {
            background: rgba(59, 130, 246, 0.3);
            color: #93c5fd;
            border: 1px solid rgba(59, 130, 246, 0.5);
        }
        
        .btn-warning {
            background: rgba(245, 158, 11, 0.3);
            color: #fcd34d;
            border: 1px solid rgba(245, 158, 11, 0.5);
        }
        
        .btn-danger {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            border: 1px solid rgba(239, 68, 68, 0.5);
        }
        
        .btn-success {
            background: rgba(34, 197, 94, 0.3);
            color: #86efac;
            border: 1px solid rgba(34, 197, 94, 0.5);
        }
        
        .btn:hover {
            transform: scale(1.05);
        }
        
        /* Modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .modal.active {
            display: flex;
        }
        
        .modal-content {
            background: #1e293b;
            border-radius: 16px;
            padding: 30px;
            width: 90%;
            max-width: 500px;
            border: 1px solid rgba(6, 182, 212, 0.3);
        }
        
        .modal-content h2 {
            color: #22d3ee;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #94a3b8;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px 15px;
            border: 1px solid rgba(6, 182, 212, 0.3);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.8);
            color: #e2e8f0;
            font-size: 1rem;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #22d3ee;
        }
        
        .modal-actions {
            display: flex;
            gap: 15px;
            justify-content: flex-end;
            margin-top: 25px;
        }
        
        .user-info-card {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 16px;
            padding: 25px;
            margin-bottom: 20px;
        }
        
        .user-info-card h3 {
            color: #22d3ee;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(6, 182, 212, 0.2);
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .info-item {
            padding: 10px;
            background: rgba(6, 182, 212, 0.1);
            border-radius: 8px;
        }
        
        .info-item .label {
            font-size: 0.8rem;
            color: #94a3b8;
            margin-bottom: 5px;
        }
        
        .info-item .value {
            color: #e2e8f0;
            font-weight: 500;
        }
        
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #22d3ee;
            text-decoration: none;
        }
        
        .back-link:hover {
            text-decoration: underline;
        }
        
        .danger-zone {
            margin-top: 30px;
            padding: 20px;
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 12px;
        }
        
        .danger-zone h4 {
            color: #fca5a5;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        {% block content %}{% endblock %}
    </div>
    
    <script>
        function confirmDelete(username) {
            if (confirm('⚠️ Are you sure you want to DELETE user "' + username + '"?\\n\\nThis will delete all their data including conversations and messages!')) {
                if (prompt('Type DELETE to confirm:') === 'DELETE') {
                    window.location.href = '/delete/' + username;
                }
            }
        }
        
        function confirmLogoutAll() {
            if (confirm('⚠️ This will log out ALL users. Continue?')) {
                window.location.href = '/logout-all';
            }
        }
    </script>
</body>
</html>
'''

# Home page template
HOME_TEMPLATE = '''
{% extends "base" %}
{% block content %}
<header>
    <h1>🎓 Gyanika Admin Panel</h1>
    <div class="stats">
        <div class="stat-box">
            <div class="number">{{ total_users }}</div>
            <div class="label">Total Users</div>
        </div>
        <div class="stat-box">
            <div class="number">{{ active_sessions }}</div>
            <div class="label">Active Sessions</div>
        </div>
        <div class="stat-box">
            <div class="number">{{ total_conversations }}</div>
            <div class="label">Conversations</div>
        </div>
    </div>
</header>

<div class="flash-messages">
    {% for category, message in get_flashed_messages(with_categories=true) %}
    <div class="flash {{ category }}">{{ message }}</div>
    {% endfor %}
</div>

<div class="search-bar">
    <form action="/" method="GET" style="display: flex; gap: 15px; flex: 1;">
        <input type="text" name="search" placeholder="🔍 Search by username, email or name..." value="{{ search_query }}">
        <button type="submit">Search</button>
    </form>
    <button onclick="confirmLogoutAll()" class="btn btn-warning">🚪 Logout All Users</button>
</div>

<table class="users-table">
    <thead>
        <tr>
            <th>Username</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Exam Target</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Actions</th>
        </tr>
    </thead>
    <tbody>
        {% for user in users %}
        <tr>
            <td><strong>{{ user.username }}</strong></td>
            <td>{{ user.full_name or '-' }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.exam_target or '-' }}</td>
            <td>
                <span class="status-badge {{ 'active' if user.is_active else 'inactive' }}">
                    {{ '✅ Active' if user.is_active else '❌ Inactive' }}
                </span>
            </td>
            <td>{{ user.last_login_at.strftime('%Y-%m-%d %H:%M') if user.last_login_at else 'Never' }}</td>
            <td class="actions">
                <a href="/user/{{ user.username }}" class="btn btn-info">👁️ View</a>
                <a href="/reset/{{ user.username }}" class="btn btn-warning">🔑 Reset</a>
                <a href="/toggle/{{ user.username }}" class="btn {{ 'btn-danger' if user.is_active else 'btn-success' }}">
                    {{ '🚫 Disable' if user.is_active else '✅ Enable' }}
                </a>
                <button onclick="confirmDelete('{{ user.username }}')" class="btn btn-danger">🗑️ Delete</button>
            </td>
        </tr>
        {% endfor %}
    </tbody>
</table>
{% endblock %}
'''

# User detail template
USER_TEMPLATE = '''
{% extends "base" %}
{% block content %}
<a href="/" class="back-link">← Back to Users List</a>

<div class="flash-messages">
    {% for category, message in get_flashed_messages(with_categories=true) %}
    <div class="flash {{ category }}">{{ message }}</div>
    {% endfor %}
</div>

<div class="user-info-card">
    <h3>👤 User Profile: {{ user.username }}</h3>
    <div class="info-grid">
        <div class="info-item">
            <div class="label">User ID</div>
            <div class="value">{{ user.id }}</div>
        </div>
        <div class="info-item">
            <div class="label">Username</div>
            <div class="value">{{ user.username }}</div>
        </div>
        <div class="info-item">
            <div class="label">Full Name</div>
            <div class="value">{{ user.full_name or 'Not set' }}</div>
        </div>
        <div class="info-item">
            <div class="label">Email</div>
            <div class="value">{{ user.email }}</div>
        </div>
        <div class="info-item">
            <div class="label">Exam Target</div>
            <div class="value">{{ user.exam_target or 'Not set' }}</div>
        </div>
        <div class="info-item">
            <div class="label">Language</div>
            <div class="value">{{ user.preferred_language or 'Not set' }}</div>
        </div>
        <div class="info-item">
            <div class="label">Status</div>
            <div class="value">
                <span class="status-badge {{ 'active' if user.is_active else 'inactive' }}">
                    {{ '✅ Active' if user.is_active else '❌ Inactive' }}
                </span>
            </div>
        </div>
        <div class="info-item">
            <div class="label">Created At</div>
            <div class="value">{{ user.created_at.strftime('%Y-%m-%d %H:%M') }}</div>
        </div>
        <div class="info-item">
            <div class="label">Last Login</div>
            <div class="value">{{ user.last_login_at.strftime('%Y-%m-%d %H:%M') if user.last_login_at else 'Never' }}</div>
        </div>
    </div>
</div>

<div class="user-info-card">
    <h3>📊 Statistics</h3>
    <div class="info-grid">
        <div class="info-item">
            <div class="label">Active Sessions</div>
            <div class="value">{{ sessions_count }}</div>
        </div>
        <div class="info-item">
            <div class="label">Total Conversations</div>
            <div class="value">{{ conversations_count }}</div>
        </div>
        <div class="info-item">
            <div class="label">Total Messages</div>
            <div class="value">{{ messages_count }}</div>
        </div>
    </div>
</div>

<div class="user-info-card">
    <h3>⚡ Quick Actions</h3>
    <div class="actions" style="gap: 15px;">
        <a href="/reset/{{ user.username }}" class="btn btn-warning" style="padding: 12px 25px;">🔑 Reset Password</a>
        <a href="/toggle/{{ user.username }}" class="btn {{ 'btn-danger' if user.is_active else 'btn-success' }}" style="padding: 12px 25px;">
            {{ '🚫 Disable Account' if user.is_active else '✅ Enable Account' }}
        </a>
        <a href="/logout-user/{{ user.username }}" class="btn btn-info" style="padding: 12px 25px;">🚪 Force Logout</a>
    </div>
</div>

<div class="danger-zone">
    <h4>⚠️ Danger Zone</h4>
    <p style="margin-bottom: 15px; color: #94a3b8;">Deleting this user will permanently remove all their data including conversations and messages.</p>
    <button onclick="confirmDelete('{{ user.username }}')" class="btn btn-danger" style="padding: 12px 25px;">🗑️ Delete User Permanently</button>
</div>
{% endblock %}
'''

# Reset password template
RESET_TEMPLATE = '''
{% extends "base" %}
{% block content %}
<a href="/" class="back-link">← Back to Users List</a>

<div class="flash-messages">
    {% for category, message in get_flashed_messages(with_categories=true) %}
    <div class="flash {{ category }}">{{ message }}</div>
    {% endfor %}
</div>

<div class="user-info-card">
    <h3>🔑 Reset Password: {{ user.username }}</h3>
    <p style="color: #94a3b8; margin-bottom: 20px;">User: {{ user.full_name or user.username }} ({{ user.email }})</p>
    
    <form action="/reset/{{ user.username }}" method="POST">
        <div class="form-group">
            <label>New Password</label>
            <input type="password" name="password" required minlength="4" placeholder="Enter new password (min 4 characters)">
        </div>
        <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" name="confirm_password" required placeholder="Confirm new password">
        </div>
        <div class="actions">
            <a href="/" class="btn btn-info">Cancel</a>
            <button type="submit" class="btn btn-success">🔑 Reset Password</button>
        </div>
    </form>
</div>
{% endblock %}
'''


def get_connection():
    """Database connection"""
    return psycopg2.connect(**DB_CONFIG)


def render(template_name, **kwargs):
    """Render template with base"""
    templates = {
        'home': HOME_TEMPLATE,
        'user': USER_TEMPLATE,
        'reset': RESET_TEMPLATE,
    }
    full_template = HTML_TEMPLATE.replace('{% block content %}{% endblock %}', 
                                          templates[template_name].replace('{% extends "base" %}', '').replace('{% block content %}', '').replace('{% endblock %}', ''))
    return render_template_string(full_template, **kwargs)


@app.route('/')
def home():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    search_query = request.args.get('search', '')
    
    if search_query:
        cur.execute("""
            SELECT * FROM users 
            WHERE username ILIKE %s OR email ILIKE %s OR full_name ILIKE %s
            ORDER BY created_at DESC
        """, (f'%{search_query}%', f'%{search_query}%', f'%{search_query}%'))
    else:
        cur.execute("SELECT * FROM users ORDER BY created_at DESC")
    
    users = cur.fetchall()
    
    # Stats
    cur.execute("SELECT COUNT(*) as count FROM users")
    total_users = cur.fetchone()['count']
    
    cur.execute("SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()")
    active_sessions = cur.fetchone()['count']
    
    cur.execute("SELECT COUNT(*) as count FROM conversations")
    total_conversations = cur.fetchone()['count']
    
    conn.close()
    
    return render('home', 
                  users=users, 
                  total_users=total_users,
                  active_sessions=active_sessions,
                  total_conversations=total_conversations,
                  search_query=search_query)


@app.route('/user/<username>')
def user_detail(username):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    
    if not user:
        flash('User not found!', 'error')
        conn.close()
        return redirect('/')
    
    cur.execute("SELECT COUNT(*) as count FROM sessions WHERE user_id = %s", (user['id'],))
    sessions_count = cur.fetchone()['count']
    
    cur.execute("SELECT COUNT(*) as count FROM conversations WHERE user_id = %s", (user['id'],))
    conversations_count = cur.fetchone()['count']
    
    cur.execute("""
        SELECT COUNT(*) as count FROM messages m 
        JOIN conversations c ON m.conversation_id = c.id 
        WHERE c.user_id = %s
    """, (user['id'],))
    messages_count = cur.fetchone()['count']
    
    conn.close()
    
    return render('user', 
                  user=user, 
                  sessions_count=sessions_count,
                  conversations_count=conversations_count,
                  messages_count=messages_count)


@app.route('/reset/<username>', methods=['GET', 'POST'])
def reset_password(username):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    
    if not user:
        flash('User not found!', 'error')
        conn.close()
        return redirect('/')
    
    if request.method == 'POST':
        password = request.form.get('password')
        confirm = request.form.get('confirm_password')
        
        if password != confirm:
            flash('Passwords do not match!', 'error')
            return render('reset', user=user)
        
        if len(password) < 4:
            flash('Password must be at least 4 characters!', 'error')
            return render('reset', user=user)
        
        try:
            cur.execute("""
                UPDATE users SET password_hash = crypt(%s, gen_salt('bf')) WHERE id = %s
            """, (password, user['id']))
            
            cur.execute("DELETE FROM sessions WHERE user_id = %s", (user['id'],))
            conn.commit()
            
            flash(f'Password reset successful for {username}!', 'success')
            conn.close()
            return redirect('/')
            
        except Exception as e:
            conn.rollback()
            flash(f'Error: {e}', 'error')
    
    conn.close()
    return render('reset', user=user)


@app.route('/toggle/<username>')
def toggle_user(username):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT id, username, is_active FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    
    if not user:
        flash('User not found!', 'error')
        conn.close()
        return redirect('/')
    
    new_status = not user['is_active']
    
    try:
        cur.execute("UPDATE users SET is_active = %s WHERE id = %s", (new_status, user['id']))
        
        if not new_status:
            cur.execute("DELETE FROM sessions WHERE user_id = %s", (user['id'],))
        
        conn.commit()
        
        status = 'enabled' if new_status else 'disabled'
        flash(f'User {username} has been {status}!', 'success')
        
    except Exception as e:
        conn.rollback()
        flash(f'Error: {e}', 'error')
    
    conn.close()
    return redirect('/')


@app.route('/delete/<username>')
def delete_user(username):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT id, username FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    
    if not user:
        flash('User not found!', 'error')
        conn.close()
        return redirect('/')
    
    try:
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user['id'],))
        cur.execute("DELETE FROM learning_progress WHERE user_id = %s", (user['id'],))
        cur.execute("DELETE FROM conversations WHERE user_id = %s", (user['id'],))
        cur.execute("DELETE FROM users WHERE id = %s", (user['id'],))
        
        conn.commit()
        flash(f'User {username} deleted successfully!', 'success')
        
    except Exception as e:
        conn.rollback()
        flash(f'Error deleting user: {e}', 'error')
    
    conn.close()
    return redirect('/')


@app.route('/logout-user/<username>')
def logout_user(username):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
    user = cur.fetchone()
    
    if user:
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user['id'],))
        conn.commit()
        flash(f'User {username} has been logged out!', 'success')
    else:
        flash('User not found!', 'error')
    
    conn.close()
    return redirect(f'/user/{username}')


@app.route('/logout-all')
def logout_all():
    conn = get_connection()
    cur = conn.cursor()
    
    cur.execute("DELETE FROM sessions")
    conn.commit()
    conn.close()
    
    flash('All users have been logged out!', 'success')
    return redirect('/')


if __name__ == '__main__':
    print("\n" + "="*60)
    print("🎓 GYANIKA ADMIN PANEL")
    print("="*60)
    print("\n📍 Open in browser: http://localhost:9000")
    print("\n   Features:")
    print("   • View all users")
    print("   • Search users")
    print("   • Reset passwords")
    print("   • Enable/Disable accounts")
    print("   • Delete users")
    print("   • Force logout")
    print("\n" + "="*60 + "\n")
    
    app.run(host='0.0.0.0', port=9000, debug=True)
