import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface SystemMessageRequest {
  fan_id: string;
  content: string;
  message_type?: 'system' | 'music';
  metadata?: any;
}

interface SystemMessageResponse {
  success: boolean;
  message: string;
  data?: {
    conversation_id: string;
    message_id: string;
  };
}

const ARTIST_SYSTEM_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemMessageResponse>
) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
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

    // 驗證只有系統或特定權限用戶才能發送系統訊息
    if (user.userId !== ARTIST_SYSTEM_ID) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to send system messages'
      });
    }

    const { fan_id, content, message_type = 'system', metadata }: SystemMessageRequest = req.body;

    if (!fan_id || !content) {
      return res.status(400).json({
        success: false,
        message: 'Fan ID and content are required'
      });
    }

    // 檢查粉絲是否存在
    const fanQuery = 'SELECT id FROM users WHERE id = $1';
    const fanResult = await db.query(fanQuery, [fan_id]);

    if (fanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fan not found'
      });
    }

    // 查找或建立與怪奇的對話
    const upsertConversationQuery = `
      INSERT INTO conversations (artist_id, fan_id)
      VALUES ($1, $2)
      ON CONFLICT (artist_id, fan_id)
      DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const conversationResult = await db.query(upsertConversationQuery, [
      ARTIST_SYSTEM_ID,
      fan_id
    ]);

    const conversation_id = conversationResult.rows[0].id;

    // 發送系統訊息
    const insertMessageQuery = `
      INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const messageResult = await db.query(insertMessageQuery, [
      conversation_id,
      ARTIST_SYSTEM_ID,
      'artist',
      content,
      message_type,
      metadata ? JSON.stringify(metadata) : null
    ]);

    const message_id = messageResult.rows[0].id;

    return res.status(201).json({
      success: true,
      message: 'System message sent successfully',
      data: {
        conversation_id,
        message_id
      }
    });

  } catch (error) {
    console.error('System message error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}