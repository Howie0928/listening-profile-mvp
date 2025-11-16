import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface Conversation {
  id: string;
  artist_id: string;
  fan_id: string;
  created_at: string;
  updated_at: string;
  last_message?: {
    content: string;
    message_type: string;
    created_at: string;
    sender_type: string;
  };
  other_user?: {
    id: string;
    email: string;
  };
}

interface ConversationsResponse {
  success: boolean;
  message: string;
  data?: Conversation[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ConversationsResponse>
) {
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
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { userId } = req.query;
    const targetUserId = userId || user.userId;

    // 獲取用戶的所有對話，包含最後一則訊息和對方用戶資訊
    const conversationsQuery = `
      WITH last_messages AS (
        SELECT DISTINCT ON (conversation_id)
          conversation_id,
          content,
          message_type,
          created_at,
          sender_type
        FROM messages
        ORDER BY conversation_id, created_at DESC
      )
      SELECT
        c.*,
        lm.content as last_message_content,
        lm.message_type as last_message_type,
        lm.created_at as last_message_created_at,
        lm.sender_type as last_message_sender_type,
        CASE
          WHEN c.artist_id = $1 THEN u_fan.id
          ELSE u_artist.id
        END as other_user_id,
        CASE
          WHEN c.artist_id = $1 THEN u_fan.email
          ELSE u_artist.email
        END as other_user_email
      FROM conversations c
      LEFT JOIN last_messages lm ON c.id = lm.conversation_id
      LEFT JOIN users u_artist ON c.artist_id = u_artist.id
      LEFT JOIN users u_fan ON c.fan_id = u_fan.id
      WHERE c.artist_id = $1 OR c.fan_id = $1
      ORDER BY c.updated_at DESC
    `;

    const result = await db.query(conversationsQuery, [targetUserId]);

    const conversations: Conversation[] = result.rows.map(row => ({
      id: row.id,
      artist_id: row.artist_id,
      fan_id: row.fan_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_message: row.last_message_content ? {
        content: row.last_message_content,
        message_type: row.last_message_type,
        created_at: row.last_message_created_at,
        sender_type: row.last_message_sender_type
      } : undefined,
      other_user: {
        id: row.other_user_id,
        email: row.other_user_email
      }
    }));

    return res.status(200).json({
      success: true,
      message: 'Conversations retrieved successfully',
      data: conversations
    });

  } catch (error) {
    console.error('Conversations error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}