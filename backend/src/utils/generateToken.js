import jwt from "jsonwebtoken";

export const generateToken = (userId, sessionId) => {
  return jwt.sign({ id: userId, sessionId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
};
