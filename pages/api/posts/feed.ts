// API: 獲取消息動態列表（Feed）
// GET /api/posts/feed
import { NextApiRequest, NextApiResponse } from 'next';
import { query } from '../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface Post {
  id: string;
  title: string;
  content: string;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  post_type: string;
  author_type: string;
  author_id: string | null;
  author_name: string | null;
  game_id: string | null;
  challenge_deadline: string | null;
  reward_badge_id: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  is_pinned: boolean;
  published_at: string;
  created_at: string;

  // 用戶互動狀態（如果已登入）
  is_liked?: boolean;
  is_bookmarked?: boolean;
}

interface FeedResponse {
  posts: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 解析查詢參數
    const {
      page = '1',
      limit = '20',
      type,           // 過濾類型: announcement, game_challenge, artist_update, surprise
      pinned_only,    // 只顯示置頂
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 驗證 JWT Token（可選，用於獲取用戶互動狀態）
    let userId: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        // Token 無效，但不影響獲取公開消息
        console.log('Invalid token, continue as anonymous');
      }
    }

    // 構建查詢條件
    let whereClause = 'WHERE is_published = TRUE';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (pinned_only === 'true') {
      whereClause += ' AND is_pinned = TRUE';
    }

    if (type && type !== 'all') {
      whereClause += ` AND post_type = $${paramIndex}`;
      queryParams.push(type);
      paramIndex++;
    }

    // 查詢總數
    const countResult = await query(
      `SELECT COUNT(*) as total FROM artist_posts ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // 查詢消息列表
    let selectQuery = `
      SELECT
        ap.id,
        ap.title,
        ap.content,
        ap.media_type,
        ap.media_url,
        ap.thumbnail_url,
        ap.post_type,
        ap.author_type,
        ap.author_id,
        ap.author_name,
        ap.game_id,
        ap.challenge_deadline,
        ap.reward_badge_id,
        ap.likes_count,
        ap.comments_count,
        ap.shares_count,
        ap.views_count,
        ap.is_pinned,
        ap.published_at,
        ap.created_at
    `;

    // 如果用戶已登入，查詢互動狀態
    if (userId) {
      selectQuery += `,
        EXISTS (
          SELECT 1 FROM post_reactions pr
          WHERE pr.post_id = ap.id AND pr.user_id = $${paramIndex}
        ) as is_liked
      `;
      queryParams.push(userId);
      paramIndex++;
    }

    selectQuery += `
      FROM artist_posts ap
      ${whereClause}
      ORDER BY
        CASE WHEN ap.is_pinned = TRUE THEN 0 ELSE 1 END,
        ap.published_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);

    const result = await query(selectQuery, queryParams);

    const posts: Post[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      media_type: row.media_type,
      media_url: row.media_url,
      thumbnail_url: row.thumbnail_url,
      post_type: row.post_type,
      author_type: row.author_type,
      author_id: row.author_id,
      author_name: row.author_name,
      game_id: row.game_id,
      challenge_deadline: row.challenge_deadline,
      reward_badge_id: row.reward_badge_id,
      likes_count: parseInt(row.likes_count) || 0,
      comments_count: parseInt(row.comments_count) || 0,
      shares_count: parseInt(row.shares_count) || 0,
      views_count: parseInt(row.views_count) || 0,
      is_pinned: row.is_pinned,
      published_at: row.published_at,
      created_at: row.created_at,
      is_liked: row.is_liked || false,
    }));

    const response: FeedResponse = {
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        has_more: offset + limitNum < total,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('獲取消息列表錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
