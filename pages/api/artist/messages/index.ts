import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';
import { handleCors } from '../../../../lib/cors';

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // 簡化的查詢：獲取藝人的所有對話
    const query = `
      SELECT
        c.id as conversation_id,
        c.fan_id,
        c.created_at as conversation_created,
        c.updated_at,
        u.email as fan_email,
        u.display_name as fan_name
      FROM conversations c
      INNER JOIN users u ON u.id = c.fan_id
      WHERE c.artist_id = $1
      ORDER BY c.updated_at DESC
    `;

    const result = await db.query(query, [user.userId === SYSTEM_ARTIST_ID ? SYSTEM_ARTIST_ID : user.userId]);

    // 為每個對話獲取最新訊息
    const messages = [];
    for (const conversation of result.rows) {
      // 獲取最新訊息
      const messageResult = await db.query(`
        SELECT content, created_at, sender_type
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [conversation.conversation_id]);

      // 計算未讀訊息數量
      const unreadResult = await db.query(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE conversation_id = $1
          AND sender_type = 'fan'
          AND (metadata->>'read' IS NULL OR metadata->>'read' = 'false')
      `, [conversation.conversation_id]);

      const lastMessage = messageResult.rows[0];
      const unreadCount = parseInt(unreadResult.rows[0].count);

      messages.push({
        id: conversation.conversation_id,
        fanId: conversation.fan_id,
        fanName: conversation.fan_name || conversation.fan_email?.split('@')[0] || 'Anonymous',
        message: lastMessage?.content || '開始新對話',
        timestamp: lastMessage?.created_at || conversation.conversation_created,
        isRead: unreadCount === 0,
        unreadCount: unreadCount
      });
    }

    // 按時間排序
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      success: true,
      messages
    });

  } catch (error: any) {
    console.error('Error fetching artist messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
}