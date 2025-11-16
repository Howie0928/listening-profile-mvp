// API: 獲取頻道訊息 / 發送頻道訊息
// GET/POST /api/channels/[id]/messages
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const { id: channelId } = req.query;
    const { limit = '50', offset = '0' } = req.query;

    if (req.method === 'GET') {
      // 獲取頻道訊息
      const result = await query(
        `SELECT
          gm.id,
          gm.content,
          gm.message_type,
          gm.metadata,
          gm.like_count,
          gm.reply_count,
          gm.created_at,
          u.id as sender_id,
          u.email as sender_email,
          u.username as sender_username,
          (
            SELECT COUNT(*)
            FROM message_reactions mr
            WHERE mr.message_id = gm.id AND mr.user_id = $2
          ) > 0 as user_liked
        FROM group_messages gm
        JOIN users u ON u.id = gm.sender_id
        WHERE gm.channel_id = $1
        ORDER BY gm.created_at DESC
        LIMIT $3 OFFSET $4`,
        [channelId, userId, limit, offset]
      );

      return res.status(200).json({ messages: result.rows });
    } else if (req.method === 'POST') {
      // 發送頻道訊息
      const { content, message_type = 'text', metadata = null } = req.body;

      if (!content || content.trim() === '') {
        return res.status(400).json({ error: '訊息內容不能為空' });
      }

      // 檢查用戶是否為該社群成員
      const memberCheck = await query(
        `SELECT cm.id
        FROM community_members cm
        JOIN channels ch ON ch.community_id = cm.community_id
        WHERE ch.id = $1 AND cm.user_id = $2`,
        [channelId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: '您不是該社群成員' });
      }

      // 插入訊息
      const result = await query(
        `INSERT INTO group_messages (channel_id, sender_id, content, message_type, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [channelId, userId, content, message_type, metadata]
      );

      // 獲取發送者資訊
      const sender = await query(
        'SELECT id, email, username FROM users WHERE id = $1',
        [userId]
      );

      return res.status(201).json({
        message: {
          ...result.rows[0],
          sender: sender.rows[0],
          user_liked: false,
        },
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('頻道訊息錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
