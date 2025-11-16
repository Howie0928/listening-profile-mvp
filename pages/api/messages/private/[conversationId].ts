// API: 獲取單一對話的所有訊息
// GET /api/messages/private/[conversationId]
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
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
    const { conversationId } = req.query;
    const { limit = '50', offset = '0' } = req.query;

    // 檢查用戶是否為該對話的參與者
    const conversationCheck = await query(
      `SELECT
        c.*,
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
        END as other_user_username
      FROM conversations c
      LEFT JOIN users u_artist ON c.artist_id = u_artist.id
      LEFT JOIN users u_fan ON c.fan_id = u_fan.id
      WHERE c.id = $2 AND (c.artist_id = $1 OR c.fan_id = $1)`,
      [userId, conversationId]
    );

    if (conversationCheck.rows.length === 0) {
      return res.status(403).json({ error: '無權訪問此對話' });
    }

    const conversation = conversationCheck.rows[0];

    // 獲取對話訊息
    const messagesResult = await query(
      `SELECT
        m.*,
        u.email as sender_email,
        u.username as sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    return res.status(200).json({
      conversation: {
        id: conversation.id,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        other_user: {
          id: conversation.other_user_id,
          email: conversation.other_user_email,
          username: conversation.other_user_username,
        },
      },
      messages: messagesResult.rows.reverse(), // 反轉讓最舊的訊息在前
    });
  } catch (error) {
    console.error('獲取對話訊息錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
