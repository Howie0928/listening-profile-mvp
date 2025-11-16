import jwt from 'jsonwebtoken';
import type { NextApiRequest } from 'next';

export interface JWTPayload {
  userId: string;
  id?: string; // 別名，與 userId 相同
  email: string;
  role?: string;
  artistName?: string;
  iat: number;
  exp: number;
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return null;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function getUserFromRequest(req: NextApiRequest): JWTPayload | null {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return verifyToken(token);
}