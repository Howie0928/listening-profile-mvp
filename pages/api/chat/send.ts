import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface SendMessageRequest {
  conversation_id?: string;
  content: string;
  message_type?: 'text' | 'music' | 'system';
  metadata?: any;
  recipient_id?: string; // 用於建立新對話
}

interface SendMessageResponse {
  success: boolean;
  message: string;
  data?: {
    message_id: string;
    conversation_id: string;
    created_at: string;
  };
}

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SendMessageResponse>
) {
  // 詳細日誌：記錄所有進入的請求
  console.log('\n🔍 [CHAT SEND DEBUG] Request received');
  console.log('📝 Method:', req.method);
  console.log('📝 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📝 接收到的請求 body:', JSON.stringify(req.body, null, 2));

  if (handleCors(req, res)) {
    console.log('✅ [CHAT SEND DEBUG] CORS preflight handled');
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ [CHAT SEND DEBUG] Method not allowed:', req.method);
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    console.log('🔐 [CHAT SEND DEBUG] Verifying authentication...');
    const user = getUserFromRequest(req);
    if (!user) {
      console.log('❌ [CHAT SEND DEBUG] Authentication failed - no valid token');
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    console.log('✅ [CHAT SEND DEBUG] User authenticated:', user.userId);

    console.log('📋 [CHAT SEND DEBUG] Parsing request body...');
    const {
      conversation_id,
      content,
      message_type = 'text',
      metadata,
      recipient_id
    }: SendMessageRequest = req.body;

    // 詳細驗證日誌
    console.log('📝 [CHAT SEND DEBUG] Extracted fields:');
    console.log('  - conversation_id:', conversation_id);
    console.log('  - content:', content ? `"${content}" (length: ${content.length})` : 'MISSING');
    console.log('  - message_type:', message_type);
    console.log('  - metadata:', metadata);
    console.log('  - recipient_id:', recipient_id);

    // 檢查必要欄位
    const missingFields = [];
    if (!content) missingFields.push('content');
    if (!conversation_id && !recipient_id) missingFields.push('conversation_id or recipient_id');

    if (missingFields.length > 0) {
      console.log('❌ [CHAT SEND DEBUG] 缺少的必要欄位:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    if (!content) {
      console.log('❌ [CHAT SEND DEBUG] Content validation failed');
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    let finalConversationId = conversation_id;

    // 如果沒有提供 conversation_id 但有 recipient_id，則建立或查找對話
    if (!finalConversationId && recipient_id) {
      console.log('🔄 [CHAT SEND DEBUG] Creating/finding conversation...');

      // 決定誰是藝人誰是粉絲
      let artist_id: string;
      let fan_id: string;

      if (user.userId === SYSTEM_ARTIST_ID) {
        artist_id = user.userId;
        fan_id = recipient_id;
      } else {
        artist_id = SYSTEM_ARTIST_ID;
        fan_id = user.userId;
      }

      console.log('📝 [CHAT SEND DEBUG] Conversation participants:');
      console.log('  - artist_id:', artist_id);
      console.log('  - fan_id:', fan_id);

      try {
        // 查找或建立對話
        const conversationQuery = `
          INSERT INTO conversations (artist_id, fan_id)
          VALUES ($1, $2)
          ON CONFLICT (artist_id, fan_id)
          DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `;

        console.log('🗃️ [CHAT SEND DEBUG] Executing conversation query:', conversationQuery);
        console.log('🗃️ [CHAT SEND DEBUG] Query parameters:', [artist_id, fan_id]);

        const conversationResult = await db.query(conversationQuery, [artist_id, fan_id]);

        console.log('✅ [CHAT SEND DEBUG] Conversation query result:', conversationResult.rows);
        finalConversationId = conversationResult.rows[0].id;
        console.log('✅ [CHAT SEND DEBUG] Final conversation ID:', finalConversationId);
      } catch (dbError: any) {
        console.error('❌ [CHAT SEND DEBUG] 資料庫錯誤 (創建對話):', dbError.message);
        console.error('❌ [CHAT SEND DEBUG] 具體錯誤:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database error while creating conversation'
        });
      }
    }

    if (!finalConversationId) {
      console.log('❌ [CHAT SEND DEBUG] No conversation ID available');
      return res.status(400).json({
        success: false,
        message: 'Conversation ID or recipient ID is required'
      });
    }

    console.log('🔐 [CHAT SEND DEBUG] Verifying conversation access...');
    try {
      // 驗證用戶是否有權限發送到此對話
      const conversationQuery = `
        SELECT * FROM conversations
        WHERE id = $1 AND (artist_id = $2 OR fan_id = $2)
      `;

      console.log('🗃️ [CHAT SEND DEBUG] Executing access verification query:', conversationQuery);
      console.log('🗃️ [CHAT SEND DEBUG] Query parameters:', [finalConversationId, user.userId]);

      const conversationResult = await db.query(conversationQuery, [finalConversationId, user.userId]);

      console.log('✅ [CHAT SEND DEBUG] Access verification result:', conversationResult.rows);

      if (conversationResult.rows.length === 0) {
        console.log('❌ [CHAT SEND DEBUG] Access denied - user not in conversation');
        return res.status(403).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      const conversation = conversationResult.rows[0];
      const sender_type = conversation.artist_id === user.userId ? 'artist' : 'fan';

      console.log('✅ [CHAT SEND DEBUG] Access granted, sender type:', sender_type);

      console.log('💬 [CHAT SEND DEBUG] Inserting message...');
      // 插入新訊息
      const insertMessageQuery = `
        INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `;

      const queryParams = [
        finalConversationId,
        user.userId,
        sender_type,
        content,
        message_type,
        metadata ? JSON.stringify(metadata) : null
      ];

      console.log('🗃️ [CHAT SEND DEBUG] Executing message insert query:', insertMessageQuery);
      console.log('🗃️ [CHAT SEND DEBUG] Query parameters:', queryParams);

      const messageResult = await db.query(insertMessageQuery, queryParams);

      console.log('✅ [CHAT SEND DEBUG] Message insert result:', messageResult.rows);
      const newMessage = messageResult.rows[0];

      console.log('🎉 [CHAT SEND DEBUG] Message sent successfully!');
      console.log('📝 [CHAT SEND DEBUG] Response data:');
      console.log('  - message_id:', newMessage.id);
      console.log('  - conversation_id:', finalConversationId);
      console.log('  - created_at:', newMessage.created_at);

      return res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          message_id: newMessage.id,
          conversation_id: finalConversationId,
          created_at: newMessage.created_at
        }
      });

    } catch (dbError: any) {
      console.error('❌ [CHAT SEND DEBUG] 資料庫錯誤 (訊息操作):', dbError.message);
      console.error('❌ [CHAT SEND DEBUG] 具體錯誤:', dbError);
      console.error('❌ [CHAT SEND DEBUG] 錯誤堆疊:', dbError.stack);
      return res.status(500).json({
        success: false,
        message: 'Database error while processing message'
      });
    }

  } catch (error: any) {
    console.error('❌ [CHAT SEND DEBUG] 發生未預期錯誤:', error.message);
    console.error('❌ [CHAT SEND DEBUG] 具體錯誤:', error);
    console.error('❌ [CHAT SEND DEBUG] 錯誤堆疊:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}console.log('[CHAT SEND DEBUG] Ready to receive requests on port 3001');
