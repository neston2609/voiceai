import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Store } from "../../data.js";
import type { User } from "../../types.js";

const accessSecret = () => process.env.JWT_ACCESS_SECRET ?? "development-access-secret";
const refreshSecret = () => process.env.JWT_REFRESH_SECRET ?? "development-refresh-secret";

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: User["role"];
  mustChangePassword: boolean;
}

export function publicUser(user: User): AuthUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword
  };
}

export function signTokens(user: User) {
  const payload = { sub: user.id, organizationId: user.organizationId, role: user.role };
  return {
    accessToken: jwt.sign(payload, accessSecret(), { expiresIn: "15m" }),
    refreshToken: jwt.sign(payload, refreshSecret(), { expiresIn: "7d" })
  };
}

export async function login(store: Store, email: string, password: string) {
  const user = store.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.isActive) throw new Error("Invalid credentials");
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    throw new Error("Account locked");
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }
    throw new Error("Invalid credentials");
  }
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.lastLoginAt;
  return { user: publicUser(user), ...signTokens(user) };
}

export async function changePassword(store: Store, userId: string, currentPassword: string, newPassword: string) {
  if (newPassword.length < 10 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error("Password must be at least 10 characters and include uppercase and number");
  }
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password is invalid");
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.updatedAt = new Date().toISOString();
  return { user: publicUser(user), ...signTokens(user) };
}
