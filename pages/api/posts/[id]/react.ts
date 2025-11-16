// API: 對消息按讚/取消按讚
// POST /api/posts/:id/react
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface ReactRequest {
  reaction_type?: 'like' | 'love' | 'fire' | 'clap' | 'heart';
}

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
    const { id: postId } = req.query;

    if (!postId || typeof postId !== 'string') {
      return res.status(400).json({ error: '無效的 post ID' });
    }

    // 解析 reaction_type（預設為 'like'）
    const { reaction_type = 'like' }: ReactRequest = req.body;

    // 驗證 reaction_type
    const validReactionTypes = ['like', 'love', 'fire', 'clap', 'heart'];
    if (!validReactionTypes.includes(reaction_type)) {
      return res.status(400).json({
        error: `無效的 reaction_type，必須是: ${validReactionTypes.join(', ')}`,
      });
    }

    // 檢查消息是否存在
    const postCheck = await query(
      'SELECT id, likes_count FROM artist_posts WHERE id = $1',
      [postId]
    );

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: '找不到該消息' });
    }

    // 檢查用戶是否已經按過讚
    const existingReaction = await query(
      'SELECT id FROM post_reactions WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    let action: 'liked' | 'unliked';
    let newLikesCount: number;

    if (existingReaction.rows.length > 0) {
      // 已經按過讚，執行取消按讚
      await query(
        'DELETE FROM post_reactions WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );

      // 減少按讚數
      const updateResult = await query(
        'UPDATE artist_posts SET likes_count = likes_count - 1 WHERE id = $1 RETURNING likes_count',
        [postId]
      );

      newLikesCount = parseInt(updateResult.rows[0].likes_count);
      action = 'unliked';
    } else {
      // 尚未按讚，執行按讚
      await query(
        `INSERT INTO post_reactions (user_id, post_id, reaction_type)
         VALUES ($1, $2, $3)`,
        [userId, postId, reaction_type]
      );

      // 增加按讚數
      const updateResult = await query(
        'UPDATE artist_posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
        [postId]
      );

      newLikesCount = parseInt(updateResult.rows[0].likes_count);
      action = 'liked';
    }

    return res.status(200).json({
      message: action === 'liked' ? '已按讚' : '已取消按讚',
      action,
      likes_count: newLikesCount,
      post_id: postId,
    });
  } catch (error) {
    console.error('按讚操作錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
