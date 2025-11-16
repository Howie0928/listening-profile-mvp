import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { db } from '../../../lib/db';

interface SetupResponse {
  success: boolean;
  message: string;
  account?: {
    id: string;
    email: string;
    role: string;
    artistName: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SetupResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Security check - in production, this should have proper admin authentication
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== 'setup-artist-qzzy-123') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });
  }

  try {
    console.log('Setting up artist account for 怪奇...');

    // Generate password hash for '123456'
    const passwordHash = await bcrypt.hash('123456', 10);

    // Add role and artist_name columns if they don't exist
    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'fan' CHECK (role IN ('fan', 'artist'))
    `);

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255)
    `);

    // Check if account exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE id = $1 OR email = $2',
      ['00000000-0000-0000-0000-000000000001', 'qzzy@artist.com']
    );

    if (existingUser.rows.length > 0) {
      // Update existing account
      await db.query(`
        UPDATE users
        SET
          email = 'qzzy@artist.com',
          password_hash = $1,
          role = 'artist',
          artist_name = '怪奇'
        WHERE id = '00000000-0000-0000-0000-000000000001'
           OR email = 'qzzy@artist.com'
      `, [passwordHash]);
    } else {
      // Create new account
      await db.query(`
        INSERT INTO users (
          id,
          email,
          password_hash,
          role,
          artist_name,
          created_at
        ) VALUES (
          '00000000-0000-0000-0000-000000000001',
          'qzzy@artist.com',
          $1,
          'artist',
          '怪奇',
          CURRENT_TIMESTAMP
        )
      `, [passwordHash]);
    }

    return res.status(200).json({
      success: true,
      message: 'Artist account created/updated successfully',
      account: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'qzzy@artist.com',
        role: 'artist',
        artistName: '怪奇'
      }
    });

  } catch (error) {
    console.error('Error setting up artist account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to setup artist account'
    });
  }
}