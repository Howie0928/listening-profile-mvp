// API: 獲取私訊列表（整合好友資訊）
// GET /api/messages/private
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface PrivateMessage {
  conversation_id: string;
  other_user: {
    id: string;
    email: string;
    username?: string;
  };
  last_message: {
    content: string;
    sender_type: string;
    created_at: string;
  } | null;
  unread_count: number;
  updated_at: string;
}

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

    // 獲取所有私訊對話，包含最後一則訊息和未讀數
    const result = await db.query(
      `WITH last_messages AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          content,
          sender_type,
          created_at
        FROM messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id as conversation_id,
        c.updated_at,
        CASE
          WHEN c.artist_id = $1 THEN c.fan_id
          ELSE c.artist_id
        END as other_user_id,
        CASE
          WHEN c.artist_id = $1 THEN u_fan.email
          ELSE u_artist.email
        END as other_user_email,
        CASE
          WHEN c.artist_id = $1 THEN u_fan.username
          ELSE u_artist.username
        END as other_user_username,
        lm.content as last_message_content,
        lm.sender_type as last_message_sender_type,
        lm.created_at as last_message_created_at,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.conversation_id = c.id
          AND m.sender_id != $1
          AND m.created_at > COALESCE(
            (SELECT last_read_at FROM conversations WHERE id = c.id),
            c.created_at
          )
        ) as unread_count
      FROM conversations c
      LEFT JOIN last_messages lm ON c.id = lm.conversation_id
      LEFT JOIN users u_artist ON c.artist_id = u_artist.id
      LEFT JOIN users u_fan ON c.fan_id = u_fan.id
      WHERE c.artist_id = $1 OR c.fan_id = $1
      ORDER BY c.updated_at DESC`,
      [userId]
    );

    const privateMessages: PrivateMessage[] = result.rows.map((row) => ({
      conversation_id: row.conversation_id,
      other_user: {
        id: row.other_user_id,
        email: row.other_user_email,
        username: row.other_user_username,
      },
      last_message: row.last_message_content
        ? {
            content: row.last_message_content,
            sender_type: row.last_message_sender_type,
            created_at: row.last_message_created_at,
          }
        : null,
      unread_count: parseInt(row.unread_count) || 0,
      updated_at: row.updated_at,
    }));

    return res.status(200).json({ privateMessages });
  } catch (error) {
    console.error('獲取私訊列表錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
