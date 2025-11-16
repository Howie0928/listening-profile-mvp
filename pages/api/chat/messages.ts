import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface SendMessageRequest {
  conversation_id: string;
  content: string;
  message_type?: 'text' | 'music' | 'system';
  metadata?: any;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: 'artist' | 'fan';
  content: string;
  message_type: 'text' | 'music' | 'system';
  metadata?: any;
  created_at: string;
}

interface MessagesResponse {
  success: boolean;
  message: string;
  data?: Message | Message[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MessagesResponse>
) {
  if (handleCors(req, res)) {
    return;
  }

  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.method === 'POST') {
      return await handleSendMessage(req, res, user);
    } else if (req.method === 'GET') {
      return await handleGetMessages(req, res, user);
    } else {
      return res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Chat messages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

async function handleSendMessage(
  req: NextApiRequest,
  res: NextApiResponse<MessagesResponse>,
  user: any
) {
  const { conversation_id, content, message_type = 'text', metadata }: SendMessageRequest = req.body;

  if (!conversation_id || !content) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID and content are required'
    });
  }

  // 驗證用戶是否有權限發送到此對話
  const conversationQuery = `
    SELECT * FROM conversations
    WHERE id = $1 AND (artist_id = $2 OR fan_id = $2)
  `;
  const conversationResult = await db.query(conversationQuery, [conversation_id, user.userId]);

  if (conversationResult.rows.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this conversation'
    });
  }

  const conversation = conversationResult.rows[0];
  const sender_type = conversation.artist_id === user.userId ? 'artist' : 'fan';

  // 插入新訊息
  const insertMessageQuery = `
    INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const messageResult = await db.query(insertMessageQuery, [
    conversation_id,
    user.userId,
    sender_type,
    content,
    message_type,
    metadata ? JSON.stringify(metadata) : null
  ]);

  const newMessage = messageResult.rows[0];

  return res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      id: newMessage.id,
      conversation_id: newMessage.conversation_id,
      sender_id: newMessage.sender_id,
      sender_type: newMessage.sender_type,
      content: newMessage.content,
      message_type: newMessage.message_type,
      metadata: newMessage.metadata,
      created_at: newMessage.created_at
    }
  });
}

async function handleGetMessages(
  req: NextApiRequest,
  res: NextApiResponse<MessagesResponse>,
  user: any
) {
  const { conversation_id } = req.query;

  if (!conversation_id) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    });
  }

  // 驗證用戶是否有權限讀取此對話
  const conversationQuery = `
    SELECT * FROM conversations
    WHERE id = $1 AND (artist_id = $2 OR fan_id = $2)
  `;
  const conversationResult = await db.query(conversationQuery, [conversation_id, user.userId]);

  if (conversationResult.rows.length === 0) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this conversation'
    });
  }

  // 獲取對話中的所有訊息
  const messagesQuery = `
    SELECT * FROM messages
    WHERE conversation_id = $1
    ORDER BY created_at ASC
  `;
  const messagesResult = await db.query(messagesQuery, [conversation_id]);

  const messages = messagesResult.rows.map(row => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    sender_type: row.sender_type,
    content: row.content,
    message_type: row.message_type,
    metadata: row.metadata,
    created_at: row.created_at
  }));

  return res.status(200).json({
    success: true,
    message: 'Messages retrieved successfully',
    data: messages
  });
}