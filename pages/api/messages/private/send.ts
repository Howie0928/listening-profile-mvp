// API: 發送私訊
// POST /api/messages/private/send
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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
    const { receiver_id, content, message_type = 'text', metadata = null } = req.body;

    if (!receiver_id || !content || content.trim() === '') {
      return res.status(400).json({ error: '接收者和訊息內容不能為空' });
    }

    // 檢查接收者是否存在
    const receiverCheck = await query('SELECT id FROM users WHERE id = $1', [receiver_id]);
    if (receiverCheck.rows.length === 0) {
      return res.status(404).json({ error: '接收者不存在' });
    }

    // 查找或建立對話（使用現有的 conversations 表）
    // 需要確定誰是 artist 誰是 fan（暫時先用 user_id 順序決定）
    const artist_id = userId < receiver_id ? userId : receiver_id;
    const fan_id = userId < receiver_id ? receiver_id : userId;

    let conversationResult = await query(
      `INSERT INTO conversations (artist_id, fan_id)
      VALUES ($1, $2)
      ON CONFLICT (artist_id, fan_id)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [artist_id, fan_id]
    );

    const conversationId = conversationResult.rows[0].id;

    // 插入訊息（決定 sender_type）
    const sender_type = userId === artist_id ? 'artist' : 'fan';

    const messageResult = await query(
      `INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [conversationId, userId, sender_type, content, message_type, metadata]
    );

    return res.status(201).json({
      message: messageResult.rows[0],
      conversation_id: conversationId,
    });
  } catch (error) {
    console.error('發送私訊錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
