import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/ip-utils";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const normalizedEmail = email.toLowerCase();
        const ip = getClientIpFromHeaders(req?.headers as Headers || new Headers());

        // Per-email rate limit: 5 attempts per 15 minutes
        const emailCheck = await checkRateLimit(`login:email:${normalizedEmail}`, {
          windowMs: 15 * 60 * 1000,
          maxRequests: 5,
        });
        if (!emailCheck.allowed) {
          // Rate limit enforced server-side. Returning null causes NextAuth to
          // return 401 (not 429) — this is intentional to prevent information
          // leakage about rate-limit state or account enumeration.
          console.warn(`[AUTH] Rate limited (email): email=${normalizedEmail}`);
          return null;
        }

        // Per-IP rate limit: 20 attempts per 15 minutes
        const ipCheck = await checkRateLimit(`login:ip:${ip}`, {
          windowMs: 15 * 60 * 1000,
          maxRequests: 20,
        });
        if (!ipCheck.allowed) {
          // Same rationale as email rate limit — 401 masks rate-limit status.
          console.warn(`[AUTH] Rate limited (IP): ip=${ip}`);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          console.warn(`[AUTH] Login failed: unknown email=${normalizedEmail}`);
          return null;
        }

        if (!user.emailVerified) {
          console.warn(`[AUTH] Login failed: unverified email=${normalizedEmail}`);
          return null;
        }

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) {
          console.warn(`[AUTH] Login failed: bad password for email=${normalizedEmail}`);
          return null;
        }

        console.info(`[AUTH] Login success: email=${normalizedEmail} userId=${user.id}`);
        return { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
});
