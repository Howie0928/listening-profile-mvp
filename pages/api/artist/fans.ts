import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface Fan {
  id: string;
  nickname: string;
  joinDate: string;
  hasConversation: boolean;
  lastMessage?: string;
  unreadCount: number;
}

interface FansListResponse {
  success: boolean;
  message: string;
  fans?: Fan[];
}

const ARTIST_ID = '00000000-0000-0000-0000-000000000001'; // 怪奇的 ID

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FansListResponse>
) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // 驗證用戶身份
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // 檢查是否為藝人賬戶
    if (user.userId !== ARTIST_ID) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only artists can access this endpoint'
      });
    }

    // 查詢粉絲列表 - 簡化版查詢
    const query = `
      SELECT
        u.id,
        u.email,
        u.created_at,
        c.id as conversation_id,
        c.created_at as conversation_created_at,
        c.updated_at as conversation_updated_at,
        m.last_message,
        m.unread_count
      FROM users u
      LEFT JOIN conversations c ON c.fan_id = u.id AND c.artist_id = $1
      LEFT JOIN LATERAL (
        SELECT
          MAX(msg.content) as last_message,
          COUNT(CASE WHEN msg.sender_type = 'fan' THEN 1 END)::integer as unread_count
        FROM messages msg
        WHERE msg.conversation_id = c.id
      ) m ON TRUE
      WHERE u.id != $1
        AND c.id IS NOT NULL
      ORDER BY COALESCE(c.updated_at, c.created_at, u.created_at) DESC
    `;

    const result = await db.query(query, [ARTIST_ID]);

    // 格式化粉絲數據
    const fans: Fan[] = result.rows.map(row => ({
      id: row.id,
      nickname: row.email.split('@')[0], // 使用 email 前綴作為暱稱
      joinDate: new Date(row.conversation_created_at || row.created_at).toISOString().split('T')[0],
      hasConversation: !!row.conversation_id,
      lastMessage: row.last_message || undefined,
      unreadCount: row.unread_count || 0
    }));

    return res.status(200).json({
      success: true,
      message: 'Fans list retrieved successfully',
      fans
    });

  } catch (error) {
    console.error('Error fetching fans list:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}