import jwt from "jsonwebtoken";

export interface JWTPayload {
  sub: string;
  email: string;
  systemRole: "user" | "platform_admin";
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET environment variable is missing or too short (min 32 chars)");
  }
  return secret;
}

export function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "15m" });
}

export function verifyAccessToken(token: string): JWTPayload {
  return jwt.verify(token, getSecret()) as JWTPayload;
}
