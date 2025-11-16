// API: 對訊息按讚/取消按讚
// POST /api/messages/[id]/react
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
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
    const { id: messageId } = req.query;
    const { reaction_type = 'like', action = 'toggle' } = req.body; // action: 'add', 'remove', 'toggle'

    // 檢查訊息是否存在
    const messageCheck = await db.query(
      'SELECT id FROM group_messages WHERE id = $1',
      [messageId]
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ error: '訊息不存在' });
    }

    // 檢查是否已經按過讚
    const existingReaction = await db.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
      [messageId, userId, reaction_type]
    );

    let result;

    if (action === 'toggle') {
      if (existingReaction.rows.length > 0) {
        // 取消按讚
        await db.query(
          'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
          [messageId, userId, reaction_type]
        );
        result = { action: 'removed', reaction_type };
      } else {
        // 新增按讚
        await db.query(
          'INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)',
          [messageId, userId, reaction_type]
        );
        result = { action: 'added', reaction_type };
      }
    } else if (action === 'add') {
      if (existingReaction.rows.length === 0) {
        await db.query(
          'INSERT INTO message_reactions (message_id, user_id, reaction_type) VALUES ($1, $2, $3)',
          [messageId, userId, reaction_type]
        );
      }
      result = { action: 'added', reaction_type };
    } else if (action === 'remove') {
      await db.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND reaction_type = $3',
        [messageId, userId, reaction_type]
      );
      result = { action: 'removed', reaction_type };
    }

    // 獲取更新後的按讚數
    const likeCountResult = await db.query(
      'SELECT like_count FROM group_messages WHERE id = $1',
      [messageId]
    );

    return res.status(200).json({
      ...result,
      like_count: likeCountResult.rows[0].like_count,
    });
  } catch (error) {
    console.error('訊息反應錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
