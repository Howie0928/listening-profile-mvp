import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface Collection {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  rarity: 'legendary' | 'epic' | 'rare' | 'common';
  type: string;
  thumbnail: string | null;
  obtained: string;
  description: string | null;
  totalSupply: number | null;
  ownedBy: number;
  isFavorited: boolean;
}

interface CollectionsResponse {
  success: boolean;
  message?: string;
  data?: {
    collections: Collection[];
    total: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CollectionsResponse>
) {
  // 處理 CORS
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

    // 從 query 取得篩選條件
    const { artist_id, rarity, type } = req.query;

    let query = `
      SELECT
        aec.id,
        aec.title,
        aec.description,
        aec.content_type,
        aec.rarity,
        aec.thumbnail_url,
        aec.total_supply,
        aec.current_supply,
        aec.artist_id,
        u.username as artist_name,
        uc.obtained_at,
        uc.is_favorited
      FROM user_collections uc
      JOIN artist_exclusive_contents aec ON uc.content_id = aec.id
      LEFT JOIN users u ON aec.artist_id = u.id
      WHERE uc.user_id = $1
    `;

    const params: any[] = [user.id];
    let paramIndex = 2;

    // 動態添加篩選條件
    if (artist_id) {
      query += ` AND aec.artist_id = $${paramIndex}`;
      params.push(artist_id);
      paramIndex++;
    }

    if (rarity) {
      query += ` AND aec.rarity = $${paramIndex}`;
      params.push(rarity);
      paramIndex++;
    }

    if (type) {
      query += ` AND aec.content_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ' ORDER BY uc.obtained_at DESC';

    const result = await db.query(query, params);

    const collections: Collection[] = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      artist: row.artist_name || '未知藝人',
      artistId: row.artist_id,
      rarity: row.rarity,
      type: row.content_type,
      thumbnail: row.thumbnail_url,
      obtained: row.obtained_at,
      description: row.description,
      totalSupply: row.total_supply,
      ownedBy: row.current_supply || 0,
      isFavorited: row.is_favorited || false,
    }));

    return res.status(200).json({
      success: true,
      data: {
        collections,
        total: collections.length,
      },
    });

  } catch (error) {
    console.error('Error fetching collections:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
