import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../../../lib/prisma";
import { env } from "../../../config/env";
import { signAuthToken } from "../../../utils/jwt";

type RegisterInput = {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
};

type LoginInput = {
  identifier: string;
  password: string;
};

type GoogleLoginInput = {
  idToken: string;
};

const googleClient = new OAuth2Client(env.googleClientId || undefined);

const sanitizeUsername = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

const ensureRole = async (name: string, description: string) => {
  const existingRole = await prisma.user_role.findUnique({ where: { name } });
  if (existingRole) return existingRole;

  return prisma.user_role.create({
    data: { name, description },
  });
};

const toAuthResponse = (user: {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  user_role: { name: string } | null;
}) => {
  const role = user.user_role?.name ?? "community_member";

  return {
    token: signAuthToken(user.id, role),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      phone: user.phone,
      addressLine1: user.address_line1,
      addressLine2: user.address_line2,
      city: user.city,
      role,
    },
  };
};

const generateUniqueUsername = async (source: string) => {
  const base = sanitizeUsername(source) || `user${Date.now()}`;

  let candidate = base;
  let suffix = 1;

  while (await prisma.users.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${suffix}`.slice(0, 24);
    suffix += 1;
  }

  return candidate;
};

export const authService = {
  register: async (input: RegisterInput) => {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();

    if (!username || !email || !input.password) {
      throw new Error("username, email and password are required");
    }

    const existing = await prisma.users.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) throw new Error("Username or email already exists");

    const communityRole = await ensureRole(
      "community_member",
      "Registered community member",
    );

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.users.create({
      data: {
        username,
        email,
        full_name: input.fullName,
        password_hash: passwordHash,
        role_id: communityRole.id,
        phone: input.phone,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        city: input.city,
      },
      include: {
        user_role: { select: { name: true } },
      },
    });

    return toAuthResponse(user);
  },

  login: async (input: LoginInput) => {
    const identifier = input.identifier.trim().toLowerCase();

    if (!identifier || !input.password) {
      throw new Error("identifier and password are required");
    }

    const user = await prisma.users.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        user_role: { select: { name: true } },
      },
    });

    if (!user) throw new Error("Invalid credentials");

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.password_hash,
    );

    if (!isPasswordValid) throw new Error("Invalid credentials");

    return toAuthResponse(user);
  },

  loginWithGoogle: async (input: GoogleLoginInput) => {
    if (!env.googleClientId) {
      throw new Error("GOOGLE_CLIENT_ID is not configured");
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: env.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      throw new Error("Google account email is not available");
    }

    const email = payload.email.toLowerCase();

    let user = await prisma.users.findUnique({
      where: { email },
      include: {
        user_role: { select: { name: true } },
      },
    });

    if (!user) {
      const communityRole = await ensureRole(
        "community_member",
        "Registered community member",
      );

      const username = await generateUniqueUsername(
        payload.given_name || email.split("@")[0],
      );

      const randomPasswordHash = await bcrypt.hash(
        `google-${Date.now()}-${email}`,
        10,
      );

      user = await prisma.users.create({
        data: {
          username,
          email,
          full_name: payload.name,
          password_hash: randomPasswordHash,
          role_id: communityRole.id,
          avatar_url: payload.picture,
        },
        include: {
          user_role: { select: { name: true } },
        },
      });
    }

    return toAuthResponse(user);
  },
};
