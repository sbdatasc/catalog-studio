import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        systemRole: "user" | "platform_admin";
      };
    }
  }
}
