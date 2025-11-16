import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

interface ReplyRequest {
  conversation_id?: string;
  recipient_id?: string;
  content: string;
  message_type?: 'text' | 'music' | 'system';
  metadata?: any;
}

interface ReplyResponse {
  success: boolean;
  message: string;
  data?: {
    message_id: string;
    conversation_id: string;
    created_at: string;
    response?: string;
  };
}

// 藝人回覆的預設訊息庫
const artistReplies = [
  '謝謝你跟我分享！音樂就是要這樣互相交流 🎵',
  '你的話讓我很感動，繼續支持音樂吧！',
  '哇，真的很開心能收到你的訊息！',
  '音樂把我們連在一起，這種感覺真棒 ✨',
  '你有什麼喜歡的音樂類型嗎？我很想知道！',
  '每個人對音樂的感受都不一樣，這就是音樂的魅力',
  '希望我的音樂能陪伴你度過每一天 🌟',
  '你的支持是我創作的動力，謝謝你！',
  '音樂是世界共通的語言，讓我們一起享受吧！',
  '有時候一首歌就能改變整個心情，對吧？'
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ReplyResponse>
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

    const { conversation_id, recipient_id, content, message_type = 'text', metadata }: ReplyRequest = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    if (!conversation_id && !recipient_id) {
      return res.status(400).json({
        success: false,
        message: 'Either conversation_id or recipient_id is required'
      });
    }

    let finalConversationId = conversation_id;

    // 如果沒有 conversation_id 但有 recipient_id，建立或查找對話
    if (!finalConversationId && recipient_id) {
      const artistId = recipient_id === SYSTEM_ARTIST_ID ? SYSTEM_ARTIST_ID : user.userId;
      const fanId = recipient_id === SYSTEM_ARTIST_ID ? user.userId : recipient_id;

      const conversationResult = await db.query(`
        INSERT INTO conversations (artist_id, fan_id)
        VALUES ($1, $2)
        ON CONFLICT (artist_id, fan_id)
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [artistId, fanId]);

      finalConversationId = conversationResult.rows[0].id;
    }

    // 確保 finalConversationId 有值
    if (!finalConversationId) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create or find conversation'
      });
    }

    // 驗證用戶是否有權限回覆此對話
    const conversationQuery = `
      SELECT * FROM conversations
      WHERE id = $1 AND (artist_id = $2 OR fan_id = $2)
    `;

    const conversationResult = await db.query(conversationQuery, [finalConversationId, user.userId]);

    if (conversationResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this conversation'
      });
    }

    const conversation = conversationResult.rows[0];
    const sender_type = conversation.artist_id === user.userId ? 'artist' : 'fan';

    // 插入用戶的訊息
    const insertMessageQuery = `
      INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;

    const messageResult = await db.query(insertMessageQuery, [
      finalConversationId,
      user.userId,
      sender_type,
      content,
      message_type,
      metadata ? JSON.stringify(metadata) : null
    ]);

    const newMessage = messageResult.rows[0];

    // 不再自動回覆，由藝人手動回覆
    let artistReply: { content: string } | null = null;

    return res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: {
        message_id: newMessage.id,
        conversation_id: finalConversationId,
        created_at: newMessage.created_at,
        response: artistReply?.content
      }
    });

  } catch (error: any) {
    console.error('Error sending reply:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send reply'
    });
  }
}