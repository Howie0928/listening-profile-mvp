import type { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { db } from '../../../lib/db';
import { handleCors } from '../../../lib/cors';

interface GoogleAuthRequest {
  id_token: string;
}

interface GoogleAuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    isNewUser?: boolean;
  };
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GoogleAuthResponse>
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
    const { id_token }: GoogleAuthRequest = req.body;

    if (!id_token) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token is required'
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is not defined in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const ticket = await client.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
    }

    const { email, sub: googleId } = payload;

    const existingUserQuery = 'SELECT id, email FROM users WHERE email = $1';
    const existingUserResult = await db.query(existingUserQuery, [email]);

    let userId: string;
    let isNewUser = false;

    if (existingUserResult.rows.length > 0) {
      userId = existingUserResult.rows[0].id;

      const updateGoogleIdQuery = 'UPDATE users SET spotify_id = $1 WHERE id = $2';
      await db.query(updateGoogleIdQuery, [googleId, userId]);
    } else {
      isNewUser = true;
      const insertUserQuery = `
        INSERT INTO users (email, password_hash, spotify_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `;

      const dummyPassword = 'google_oauth_user';
      const result = await db.query(insertUserQuery, [email, dummyPassword, googleId]);
      userId = result.rows[0].id;
    }

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
        userId,
        id: userId, // 別名，與 userId 相同
        email
      },
      jwtSecret,
      {
        expiresIn: '7d'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: userId,
        email,
        isNewUser
      }
    });

  } catch (error) {
    console.error('Google authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Google authentication failed'
    });
  }
}