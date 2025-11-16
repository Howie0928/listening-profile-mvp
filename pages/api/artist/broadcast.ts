import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';

const SYSTEM_ARTIST_ID = '00000000-0000-0000-0000-000000000001';

interface BroadcastRequest {
  content: string;
  message_type?: 'text' | 'music' | 'system';
  image_url?: string;
  music_url?: string;
  music_title?: string;
  music_artist?: string;
}

interface BroadcastResponse {
  success: boolean;
  message: string;
  data?: {
    broadcast_id: string;
    sent_to_count: number;
    created_at: string;
  };
}

// 配置 formidable 用於檔案上傳
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BroadcastResponse>
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

    // 檢查是否為藝人
    if (user.userId !== SYSTEM_ARTIST_ID) {
      return res.status(403).json({
        success: false,
        message: 'Only artists can broadcast messages'
      });
    }

    // 解析表單數據（包含檔案上傳）
    const form = formidable({
      uploadDir: path.join(process.cwd(), 'public/uploads'),
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    });

    const [fields, files] = await form.parse(req);

    const content = Array.isArray(fields.content) ? fields.content[0] : fields.content;
    const music_title = Array.isArray(fields.music_title) ? fields.music_title[0] : fields.music_title;
    const music_artist = Array.isArray(fields.music_artist) ? fields.music_artist[0] : fields.music_artist;
    const music_url = Array.isArray(fields.music_url) ? fields.music_url[0] : fields.music_url;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    let image_url = '';
    let final_music_url = music_url || '';

    // 處理圖片上傳
    if (files.image && Array.isArray(files.image) && files.image[0]) {
      const imageFile = files.image[0];
      const fileName = `broadcast_${Date.now()}_${imageFile.originalFilename}`;
      const newPath = path.join(process.cwd(), 'public/uploads', fileName);

      await fs.rename(imageFile.filepath, newPath);
      image_url = `/uploads/${fileName}`;
    }

    // 處理音樂檔案上傳
    if (files.music && Array.isArray(files.music) && files.music[0]) {
      const musicFile = files.music[0];
      const fileName = `music_${Date.now()}_${musicFile.originalFilename}`;
      const newPath = path.join(process.cwd(), 'public/uploads', fileName);

      await fs.rename(musicFile.filepath, newPath);
      final_music_url = `/uploads/${fileName}`;
    }

    // 準備訊息元數據
    const metadata: any = {};
    if (image_url) metadata.image_url = image_url;
    if (final_music_url) metadata.music_url = final_music_url;
    if (music_title) metadata.music_title = music_title;
    if (music_artist) metadata.music_artist = music_artist;

    // 獲取所有有對話的粉絲
    const fansQuery = `
      SELECT DISTINCT c.fan_id, c.id as conversation_id
      FROM conversations c
      WHERE c.artist_id = $1
    `;

    const fansResult = await db.query(fansQuery, [SYSTEM_ARTIST_ID]);

    if (fansResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fans found to broadcast to'
      });
    }

    // 為每個粉絲創建訊息（統一使用 'text' 類型，媒體資訊存在 metadata）
    const insertPromises = fansResult.rows.map(row => {
      return db.query(`
        INSERT INTO messages (conversation_id, sender_id, sender_type, content, message_type, metadata)
        VALUES ($1, $2, 'artist', $3, $4, $5)
        RETURNING id, created_at
      `, [row.conversation_id, SYSTEM_ARTIST_ID, content, 'text', JSON.stringify(metadata)]);
    });

    const results = await Promise.all(insertPromises);
    const firstResult = results[0].rows[0];

    // 更新所有對話的 updated_at
    await db.query(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE artist_id = $1
    `, [SYSTEM_ARTIST_ID]);

    return res.status(201).json({
      success: true,
      message: 'Broadcast sent successfully',
      data: {
        broadcast_id: firstResult.id,
        sent_to_count: fansResult.rows.length,
        created_at: firstResult.created_at
      }
    });

  } catch (error: any) {
    console.error('Error sending broadcast:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send broadcast'
    });
  }
}