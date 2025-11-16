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

    const { q: searchTerm, tags, limit = '50', offset = '0' } = req.query;

    const artistId = user.userId === SYSTEM_ARTIST_ID ? SYSTEM_ARTIST_ID : user.userId;

    // 使用預存函數搜尋粉絲
    const query = `
      SELECT * FROM search_fans(
        $1::UUID,
        $2::TEXT,
        $3::TEXT[],
        $4::INTEGER,
        $5::INTEGER
      )
    `;

    const result = await db.query(query, [
      artistId,
      searchTerm || null,
      tags ? (Array.isArray(tags) ? tags : [tags]) : null,
      parseInt(limit as string),
      parseInt(offset as string)
    ]);

    const fans = result.rows.map(row => ({
      fanId: row.fan_id,
      fanName: row.fan_name || row.fan_email?.split('@')[0] || 'Anonymous',
      fanEmail: row.fan_email,
      followedAt: row.followed_at,
      interactionCount: row.interaction_count,
      lastInteraction: row.last_interaction,
      notes: row.notes,
      tags: row.tags || [],
      lastMessage: row.last_message,
      unreadCount: row.unread_count,
      isActive: row.last_interaction && new Date(row.last_interaction) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }));

    return res.status(200).json({
      success: true,
      fans,
      total: fans.length
    });

  } catch (error: any) {
    console.error('Error searching fans:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search fans'
    });
  }
}