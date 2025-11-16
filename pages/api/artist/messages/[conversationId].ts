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

  const { conversationId } = req.query;

  if (!conversationId || typeof conversationId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    });
  }

  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.method === 'GET') {
    try {
      // 獲取對話中的所有訊息
      const query = `
        SELECT
          m.id,
          m.conversation_id,
          m.sender_id,
          m.sender_type,
          m.content,
          m.message_type,
          m.metadata,
          m.created_at,
          u.display_name as sender_name, -- fixed username column
          u.email as sender_email,
          c.artist_id,
          c.fan_id
        FROM messages m
        INNER JOIN conversations c ON c.id = m.conversation_id
        INNER JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
          AND (c.artist_id = $2 OR c.fan_id = $2)
        ORDER BY m.created_at ASC
      `;

      const result = await db.query(query, [conversationId, user.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or access denied'
        });
      }

      // 格式化訊息
      const messages = result.rows.map(row => ({
        id: row.id,
        senderId: row.sender_id,
        senderName: row.sender_name || row.sender_email?.split('@')[0] || 'Unknown',
        senderType: row.sender_type,
        content: row.content,
        messageType: row.message_type,
        metadata: row.metadata,
        timestamp: row.created_at,
        isArtist: row.sender_type === 'artist'
      }));

      // 如果是藝人查看，標記所有粉絲訊息為已讀
      if (user.userId === SYSTEM_ARTIST_ID || result.rows[0]?.artist_id === user.userId) {
        await db.query(`
          UPDATE messages
          SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"read": true}'::jsonb
          WHERE conversation_id = $1
            AND sender_type = 'fan'
            AND (metadata->>'read' IS NULL OR metadata->>'read' = 'false')
        `, [conversationId]);
      }

      return res.status(200).json({
        success: true,
        messages,
        conversationId,
        artistId: result.rows[0]?.artist_id,
        fanId: result.rows[0]?.fan_id
      });

    } catch (error: any) {
      console.error('Error fetching conversation messages:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch messages'
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}