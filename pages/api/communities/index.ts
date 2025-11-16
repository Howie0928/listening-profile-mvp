// API: 獲取用戶加入的社群列表
// GET /api/communities
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 驗證 JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授權' });
    }

    const token = authHeader.substring(7);
    let decoded: any;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: '無效的 token' });
    }

    const userId = decoded.userId;

    // 獲取用戶加入的所有社群
    const result = await db.query(
      `SELECT
        c.id,
        c.name,
        c.type,
        c.description,
        c.avatar_url,
        c.member_count,
        cm.role,
        cm.joined_at,
        cm.last_read_at,
        (
          SELECT COUNT(*)
          FROM channels ch
          JOIN group_messages gm ON gm.channel_id = ch.id
          WHERE ch.community_id = c.id
          AND gm.created_at > cm.last_read_at
        ) as unread_count
      FROM communities c
      JOIN community_members cm ON cm.community_id = c.id
      WHERE cm.user_id = $1
      ORDER BY c.updated_at DESC`,
      [userId]
    );

    // 為每個社群獲取頻道列表
    const communities = await Promise.all(
      result.rows.map(async (community) => {
        const channels = await db.query(
          `SELECT id, name, description, channel_type, position
          FROM channels
          WHERE community_id = $1
          ORDER BY position ASC`,
          [community.id]
        );

        return {
          ...community,
          channels: channels.rows,
        };
      })
    );

    return res.status(200).json({ communities });
  } catch (error) {
    console.error('獲取社群列表錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
