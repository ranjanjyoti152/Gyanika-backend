// Simple authentication utilities for Gyanika
// In production, replace with proper auth like NextAuth.js

export interface User {
  id: string;
  name: string;
  email: string;
  class?: string;
  school?: string;
  createdAt: string;
}

const USERS_STORAGE_KEY = 'gyanika_users';
const CURRENT_USER_KEY = 'gyanika_current_user';

// Get all registered users (client-side storage)
export function getUsers(): Record<string, User> {
  if (typeof window === 'undefined') return {};
  const users = localStorage.getItem(USERS_STORAGE_KEY);
  return users ? JSON.parse(users) : {};
}

// Save users to storage
function saveUsers(users: Record<string, User>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Register a new user
export function registerUser(
  name: string,
  email: string,
  password: string,
  classLevel?: string,
  school?: string
): { success: boolean; error?: string; user?: User } {
  const users = getUsers();

  // Check if email already exists
  const existingUser = Object.values(users).find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
  if (existingUser) {
    return { success: false, error: 'Email already registered. Please login.' };
  }

  // Create user ID from email
  const userId = `user_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const user: User = {
    id: userId,
    name,
    email: email.toLowerCase(),
    class: classLevel,
    school,
    createdAt: new Date().toISOString(),
  };

  // Store user with password hash (in production, use proper hashing)
  users[userId] = user;
  // Store password separately (very basic - use proper auth in production!)
  const passwords = getPasswords();
  passwords[userId] = btoa(password); // Basic encoding, NOT secure for production
  savePasswords(passwords);

  saveUsers(users);
  setCurrentUser(user);

  return { success: true, user };
}

// Login user
export function loginUser(
  email: string,
  password: string
): { success: boolean; error?: string; user?: User } {
  const users = getUsers();
  const passwords = getPasswords();

  // Find user by email
  const user = Object.values(users).find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return { success: false, error: 'Email not found. Please signup first.' };
  }

  // Check password
  const storedPassword = passwords[user.id];
  if (!storedPassword || btoa(password) !== storedPassword) {
    return { success: false, error: 'Incorrect password.' };
  }

  setCurrentUser(user);
  return { success: true, user };
}

// Get/set passwords (basic storage - use proper auth in production!)
function getPasswords(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const passwords = localStorage.getItem('gyanika_passwords');
  return passwords ? JSON.parse(passwords) : {};
}

function savePasswords(passwords: Record<string, string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('gyanika_passwords', JSON.stringify(passwords));
}

// Get current logged in user
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(CURRENT_USER_KEY);
  return user ? JSON.parse(user) : null;
}

// Set current user
export function setCurrentUser(user: User) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

// Logout
export function logoutUser() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CURRENT_USER_KEY);
}

// Check if user is logged in
export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}
