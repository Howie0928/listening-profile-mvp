import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';
import { handleCors } from '../../../../lib/cors';

interface InitChatRequest {
  fanId: string;
}

interface InitChatResponse {
  success: boolean;
  message: string;
  conversation?: {
    id: string;
    artistId: string;
    fanId: string;
    createdAt: string;
  };
}

const ARTIST_ID = '00000000-0000-0000-0000-000000000001'; // 怪奇的 ID

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<InitChatResponse>
) {
  // 處理 CORS
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
        message: 'Forbidden: Only artists can initiate chats'
      });
    }

    const { fanId } = req.body as InitChatRequest;

    if (!fanId) {
      return res.status(400).json({
        success: false,
        message: 'Fan ID is required'
      });
    }

    // 驗證粉絲是否存在
    const fanCheckQuery = 'SELECT id FROM users WHERE id = $1';
    const fanResult = await db.query(fanCheckQuery, [fanId]);

    if (fanResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fan not found'
      });
    }

    // 檢查對話是否已存在
    const conversationCheckQuery = `
      SELECT id, artist_id, fan_id, created_at
      FROM conversations
      WHERE artist_id = $1 AND fan_id = $2
    `;
    const existingConversation = await db.query(conversationCheckQuery, [ARTIST_ID, fanId]);

    if (existingConversation.rows.length > 0) {
      // 對話已存在，返回現有對話
      const conv = existingConversation.rows[0];
      return res.status(200).json({
        success: true,
        message: 'Conversation already exists',
        conversation: {
          id: conv.id,
          artistId: conv.artist_id,
          fanId: conv.fan_id,
          createdAt: conv.created_at
        }
      });
    }

    // 創建新對話
    const createConversationQuery = `
      INSERT INTO conversations (artist_id, fan_id)
      VALUES ($1, $2)
      RETURNING id, artist_id, fan_id, created_at
    `;
    const newConversation = await db.query(createConversationQuery, [ARTIST_ID, fanId]);

    if (newConversation.rows.length === 0) {
      throw new Error('Failed to create conversation');
    }

    const conv = newConversation.rows[0];

    // 創建系統歡迎訊息
    const welcomeMessageQuery = `
      INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type)
      VALUES ($1, $2, $3, $4, $5)
    `;
    const welcomeMessage = '嗨！我是怪奇，很高興認識你！有什麼音樂相關的話題想聊聊嗎？';

    await db.query(welcomeMessageQuery, [
      conv.id,
      ARTIST_ID,
      'artist',
      welcomeMessage,
      'text'
    ]);

    return res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      conversation: {
        id: conv.id,
        artistId: conv.artist_id,
        fanId: conv.fan_id,
        createdAt: conv.created_at
      }
    });

  } catch (error) {
    console.error('Error initializing chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}