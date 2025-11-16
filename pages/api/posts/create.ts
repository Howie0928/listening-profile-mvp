// API: 創建新消息動態
// POST /api/posts/create
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface CreatePostRequest {
  title: string;
  content: string;
  post_type: 'announcement' | 'game_challenge' | 'artist_update' | 'surprise';
  author_type: 'system' | 'admin' | 'artist';
  media_type?: 'image' | 'video' | 'audio' | 'none';
  media_url?: string;
  thumbnail_url?: string;
  game_id?: string;
  challenge_deadline?: string;
  reward_badge_id?: string;
  is_pinned?: boolean;
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
    const userRole = decoded.role; // 需要是 'artist' 角色

    // 檢查用戶角色（只有藝人和管理員可以創建消息）
    if (userRole !== 'artist') {
      return res.status(403).json({ error: '權限不足，只有藝人可以發布消息' });
    }

    // 解析請求body
    const {
      title,
      content,
      post_type,
      author_type,
      media_type = 'none',
      media_url,
      thumbnail_url,
      game_id,
      challenge_deadline,
      reward_badge_id,
      is_pinned = false,
    }: CreatePostRequest = req.body;

    // 驗證必填欄位
    if (!title || !content || !post_type || !author_type) {
      return res.status(400).json({
        error: '缺少必填欄位',
        required: ['title', 'content', 'post_type', 'author_type'],
      });
    }

    // 驗證 post_type
    const validPostTypes = ['announcement', 'game_challenge', 'artist_update', 'surprise'];
    if (!validPostTypes.includes(post_type)) {
      return res.status(400).json({
        error: `無效的 post_type，必須是: ${validPostTypes.join(', ')}`,
      });
    }

    // 驗證 author_type
    const validAuthorTypes = ['system', 'admin', 'artist'];
    if (!validAuthorTypes.includes(author_type)) {
      return res.status(400).json({
        error: `無效的 author_type，必須是: ${validAuthorTypes.join(', ')}`,
      });
    }

    // 獲取用戶資訊（作為 author_name）
    const userResult = await db.query(
      'SELECT artist_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '找不到用戶' });
    }

    const authorName = userResult.rows[0].artist_name || userResult.rows[0].email;

    // 插入新消息
    const insertResult = await db.query(
      `INSERT INTO artist_posts (
        title,
        content,
        media_type,
        media_url,
        thumbnail_url,
        post_type,
        author_type,
        author_id,
        author_name,
        game_id,
        challenge_deadline,
        reward_badge_id,
        is_pinned,
        is_published,
        published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, NOW())
      RETURNING *`,
      [
        title,
        content,
        media_type,
        media_url || null,
        thumbnail_url || null,
        post_type,
        author_type,
        userId,
        authorName,
        game_id || null,
        challenge_deadline || null,
        reward_badge_id || null,
        is_pinned,
      ]
    );

    const newPost = insertResult.rows[0];

    // 如果是遊戲挑戰，發送通知給所有用戶（未來實作）
    if (post_type === 'game_challenge') {
      // TODO: 發送推播通知
      console.log('🎮 遊戲挑戰已發布，應發送通知');
    }

    return res.status(201).json({
      message: '消息創建成功',
      post: {
        id: newPost.id,
        title: newPost.title,
        content: newPost.content,
        post_type: newPost.post_type,
        author_name: newPost.author_name,
        published_at: newPost.published_at,
        is_pinned: newPost.is_pinned,
      },
    });
  } catch (error) {
    console.error('創建消息錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
