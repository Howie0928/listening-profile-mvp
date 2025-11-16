// pages/api/artist/conversations/recent.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { handleCors } from '../../../../lib/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 查詢最近的對話
    const recentConversations = await db.query(`
      WITH RecentMessages AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          content as last_message,
          created_at as last_message_time,
          sender_type,
          sender_id
        FROM messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.id as conversation_id,
        c.fan_id,
        u.email as user_email,
        rm.last_message,
        rm.last_message_time,
        CASE
          WHEN rm.sender_type = 'fan' THEN true
          ELSE false
        END as has_unread,
        (
          SELECT COUNT(*)
          FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sender_type = 'fan'
        ) as unread_count
      FROM conversations c
      INNER JOIN RecentMessages rm ON rm.conversation_id = c.id
      LEFT JOIN users u ON u.id = c.fan_id
      WHERE c.artist_id = '00000000-0000-0000-0000-000000000001'
      ORDER BY rm.last_message_time DESC
      LIMIT 10
    `);

    // 格式化回應
    const conversations = recentConversations.rows.map(row => ({
      conversationId: row.conversation_id,
      userId: row.fan_id,
      userName: row.user_email?.split('@')[0] || '匿名用戶',
      userEmail: row.user_email,
      lastMessage: row.last_message,
      timestamp: row.last_message_time,
      hasUnread: row.has_unread,
      unreadCount: parseInt(row.unread_count || '0')
    }));

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });

  } catch (error) {
    console.error('Recent conversations API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}