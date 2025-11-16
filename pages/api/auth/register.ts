import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/db';
import { handleCors } from '../../../lib/cors';

interface RegisterRequest {
  email: string;
  password: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    artistName?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return; // 預檢請求已處理
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { email, password }: RegisterRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUserResult = await db.query(existingUserQuery, [email]);

    if (existingUserResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertUserQuery = `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'fan')
      RETURNING id, email, role
    `;

    const result = await db.query(insertUserQuery, [email, hashedPassword]);
    const newUser = result.rows[0];

    // 生成 JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const token = jwt.sign(
      {
        userId: newUser.id,
        id: newUser.id, // 別名，與 userId 相同
        email: newUser.email,
        role: newUser.role || 'fan',
        artistName: undefined
      },
      jwtSecret,
      {
        expiresIn: '7d'
      }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role || 'fan',
        artistName: undefined
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}