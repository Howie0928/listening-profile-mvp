import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';
import { handleCors } from '../../../../lib/cors';

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

interface ReplyRequest {
  conversationId?: string;
  fanId?: string;
  message: string;
  messageType?: 'text' | 'music' | 'system';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (handleCors(req, res)) return;

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

    const { conversationId, fanId, message, messageType = 'text' }: ReplyRequest = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    if (!conversationId && !fanId) {
      return res.status(400).json({
        success: false,
        message: 'Either conversationId or fanId is required'
      });
    }

    let finalConversationId = conversationId;

    // 如果沒有 conversationId，但有 fanId，則查找或創建對話
    if (!finalConversationId && fanId) {
      const artistId = user.userId === SYSTEM_ARTIST_ID ? SYSTEM_ARTIST_ID : user.userId;

      // 查找或創建對話
      const conversationResult = await db.query(`
        INSERT INTO conversations (artist_id, fan_id)
        VALUES ($1, $2)
        ON CONFLICT (artist_id, fan_id)
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [artistId, fanId]);

      finalConversationId = conversationResult.rows[0].id;
    }

    // 驗證藝人有權限回覆這個對話
    const accessCheck = await db.query(`
      SELECT id FROM conversations
      WHERE id = $1 AND artist_id = $2
    `, [finalConversationId, user.userId === SYSTEM_ARTIST_ID ? SYSTEM_ARTIST_ID : user.userId]);

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    // 插入回覆訊息
    const insertResult = await db.query(`
      INSERT INTO messages (
        conversation_id,
        sender_id,
        sender_type,
        content,
        message_type,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [
      finalConversationId,
      user.userId,
      'artist',
      message,
      messageType,
      JSON.stringify({ sentByArtist: true })
    ]);

    const newMessage = insertResult.rows[0];

    // 當藝人首次回覆時，自動將粉絲加入粉絲列表
    await db.query(`
      INSERT INTO artist_fans (artist_id, fan_id)
      SELECT c.artist_id, c.fan_id
      FROM conversations c
      WHERE c.id = $1
      ON CONFLICT (artist_id, fan_id) DO NOTHING
    `, [finalConversationId]);

    return res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: {
        messageId: newMessage.id,
        conversationId: finalConversationId,
        createdAt: newMessage.created_at
      }
    });

  } catch (error: any) {
    console.error('Error sending artist reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
}