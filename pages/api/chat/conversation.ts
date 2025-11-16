import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

interface ConversationResponse {
  success: boolean;
  message: string;
  data?: {
    conversation_id: string;
    messages: Array<{
      id: string;
      content: string;
      sender_id: string;
      sender_type: 'fan' | 'artist';
      message_type: 'text' | 'music' | 'system';
      created_at: string;
      metadata?: any;
    }>;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConversationResponse>
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

    // 查找或建立與怪奇的對話
    const conversationQuery = `
      INSERT INTO conversations (artist_id, fan_id)
      VALUES ($1, $2)
      ON CONFLICT (artist_id, fan_id)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const conversationResult = await db.query(conversationQuery, [SYSTEM_ARTIST_ID, user.userId]);
    const conversationId = conversationResult.rows[0].id;

    // 獲取所有訊息
    const messagesQuery = `
      SELECT
        id,
        content,
        sender_id,
        sender_type,
        message_type,
        created_at,
        metadata
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `;

    const messagesResult = await db.query(messagesQuery, [conversationId]);

    const messages = messagesResult.rows.map(row => ({
      id: row.id,
      content: row.content,
      sender_id: row.sender_id,
      sender_type: row.sender_type,
      message_type: row.message_type,
      created_at: row.created_at,
      metadata: row.metadata
    }));

    return res.status(200).json({
      success: true,
      message: 'Conversation retrieved successfully',
      data: {
        conversation_id: conversationId,
        messages
      }
    });

  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
}