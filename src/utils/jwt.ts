import jwt from "jsonwebtoken";
import { env } from "../config/env";

type AuthTokenPayload = {
  sub: string;
  role: string;
};

export const signAuthToken = (userId: number, role: string) => {
  const payload: AuthTokenPayload = {
    sub: userId.toString(),
    role,
  };

  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const decoded = jwt.verify(token, env.jwtSecret);

  if (typeof decoded === "string" || !decoded.sub || !decoded.role) {
    throw new Error("Invalid auth token");
  }

  return {
    sub: decoded.sub,
    role: decoded.role,
  };
};
