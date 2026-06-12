"use server";

import { signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/ip-utils";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

export async function loginUser(email: string, password: string) {
  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid credentials" };
    }
    throw error;
  }
}

export async function registerUser(data: RegisterInput) {
  const parsed = registerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid data" };
  }

  const headersList = await headers();
  const ip = getClientIpFromHeaders(headersList);
  const rateLimitKey = `register:ip:${ip}`;
  const rateLimitCheck = await checkRateLimit(rateLimitKey, { 
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5 
  });
  
  if (!rateLimitCheck.allowed) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Email already registered" };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Login failed after registration" };
    }
    throw error;
  }
}
