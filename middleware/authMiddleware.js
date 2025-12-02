import { verifyToken } from "../utils/jwt.js";
import prisma from "../utils/prisma.js";

export const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ message: "Invalid or expired token." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ message: "Server error during authentication" });
  }
};

export const authenticateOptional = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    console.error("Auth optional error:", err);
    next();
  }
};