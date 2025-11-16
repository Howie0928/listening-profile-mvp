// pages/api/artist/messages/unread.ts
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
    // 查詢未讀訊息
    const unreadMessages = await db.query(`
      SELECT
        m.id,
        m.content,
        m.created_at,
        m.sender_id,
        m.conversation_id,
        c.fan_id,
        u.email as sender_email
      FROM messages m
      INNER JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN users u ON u.id = c.fan_id
      WHERE c.artist_id = '00000000-0000-0000-0000-000000000001'
        AND m.sender_type = 'fan'
      ORDER BY m.created_at DESC
      LIMIT 50
    `);

    // 按對話分組未讀訊息
    const messagesByConversation = new Map();

    unreadMessages.rows.forEach(row => {
      const conversationId = row.conversation_id;
      if (!messagesByConversation.has(conversationId)) {
        messagesByConversation.set(conversationId, {
          conversationId,
          userId: row.fan_id,
          userName: row.sender_email?.split('@')[0] || '匿名用戶',
          userEmail: row.sender_email,
          messages: []
        });
      }

      messagesByConversation.get(conversationId).messages.push({
        id: row.id,
        content: row.content,
        timestamp: row.created_at
      });
    });

    // 轉換為陣列
    const conversations = Array.from(messagesByConversation.values());

    res.status(200).json({
      success: true,
      totalUnread: unreadMessages.rows.length,
      conversationCount: conversations.length,
      conversations: conversations.map(conv => ({
        ...conv,
        unreadCount: conv.messages.length,
        latestMessage: conv.messages[0]
      }))
    });

  } catch (error) {
    console.error('Unread messages API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}