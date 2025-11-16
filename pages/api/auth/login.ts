import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/db';
import { handleCors } from '../../../lib/cors';

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    role?: string;
    artistName?: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
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
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // 添加除錯日誌
    console.log('🔍 [LOGIN DEBUG] 嘗試登入的 email:', email);

    // 使用 LOWER() 函數來確保大小寫不敏感的查詢，並獲取 role 和 artist_name
    const userQuery = 'SELECT id, email, password_hash, role, artist_name FROM users WHERE LOWER(email) = LOWER($1)';
    console.log('🔍 [LOGIN DEBUG] 執行查詢:', userQuery);
    console.log('🔍 [LOGIN DEBUG] 查詢參數:', [email]);

    const userResult = await db.query(userQuery, [email]);

    console.log('🔍 [LOGIN DEBUG] 查詢結果數量:', userResult.rows.length);
    if (userResult.rows.length > 0) {
      console.log('🔍 [LOGIN DEBUG] 找到的用戶 email:', userResult.rows[0].email);
      console.log('🔍 [LOGIN DEBUG] 用戶角色:', userResult.rows[0].role);
      console.log('🔍 [LOGIN DEBUG] 藝人名稱:', userResult.rows[0].artist_name);
    }

    if (userResult.rows.length === 0) {
      console.log('❌ [LOGIN DEBUG] 用戶不存在，email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];
    console.log('🔍 [LOGIN DEBUG] 開始驗證密碼');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log('🔍 [LOGIN DEBUG] 密碼驗證結果:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ [LOGIN DEBUG] 密碼不正確，email:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    // 在 JWT token 中包含 role 資訊
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role || 'fan',
        artistName: user.artist_name
      },
      jwtSecret,
      {
        expiresIn: '7d'
      }
    );

    console.log('✅ [LOGIN DEBUG] 登入成功，email:', user.email);
    console.log('🔍 [LOGIN DEBUG] 生成的 JWT token:', token ? `${token.substring(0, 20)}...` : 'null');
    console.log('🔍 [LOGIN DEBUG] JWT token 長度:', token ? token.length : 0);

    const response = {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role || 'fan',
        artistName: user.artist_name || undefined
      }
    };

    console.log('🔍 [LOGIN DEBUG] 完整回應結構:', JSON.stringify(response, null, 2));
    return res.status(200).json(response);

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}