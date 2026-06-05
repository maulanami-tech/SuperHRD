import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes

function isRateLimited(key: string): boolean {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() < record.lockedUntil) return true;
  if (Date.now() >= record.lockedUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return false;
}

function recordFailedAttempt(key: string): void {
  const record = loginAttempts.get(key);
  if (!record) {
    loginAttempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        // Rate limit check
        if (isRateLimited(email)) {
          console.warn(`[AUTH] Rate limited: email=${email}`);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          recordFailedAttempt(email);
          console.warn(`[AUTH] Login failed: unknown email=${email}`);
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          recordFailedAttempt(email);
          console.warn(`[AUTH] Login failed: bad password for email=${email}`);
          return null;
        }

        // Clear rate limit on success
        loginAttempts.delete(email);
        console.info(`[AUTH] Login success: email=${email} userId=${user.id}`);
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
