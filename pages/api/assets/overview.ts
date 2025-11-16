import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface AssetsOverviewResponse {
  success: boolean;
  message?: string;
  data?: {
    coins: number;
    exclusiveContents: number;
    coupons: number;
    gameItems: number;
    rarityDistribution: {
      legendary: number;
      epic: number;
      rare: number;
      common: number;
    };
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AssetsOverviewResponse>
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

    // 取得代幣餘額
    const coinsResult = await db.query(
      'SELECT balance FROM coin_balances WHERE user_id = $1',
      [user.id]
    );
    const coins = coinsResult.rows[0]?.balance || 0;

    // 取得專屬內容數量
    const contentsResult = await db.query(
      'SELECT COUNT(*) as count FROM user_collections WHERE user_id = $1',
      [user.id]
    );
    const exclusiveContents = parseInt(contentsResult.rows[0]?.count || '0');

    // 取得優惠券數量（未使用且未過期）
    const couponsResult = await db.query(
      `SELECT COUNT(*) as count
       FROM user_collections uc
       JOIN artist_exclusive_contents aec ON uc.content_id = aec.id
       WHERE uc.user_id = $1
       AND aec.content_type = 'coupon'
       AND uc.is_used = FALSE
       AND (aec.expiry_date IS NULL OR aec.expiry_date > NOW())`,
      [user.id]
    );
    const coupons = parseInt(couponsResult.rows[0]?.count || '0');

    // 取得遊戲道具數量（預留功能）
    const gameItems = 0;

    // 取得稀有度分布
    const rarityResult = await db.query(
      `SELECT aec.rarity, COUNT(*) as count
       FROM user_collections uc
       JOIN artist_exclusive_contents aec ON uc.content_id = aec.id
       WHERE uc.user_id = $1
       GROUP BY aec.rarity`,
      [user.id]
    );

    const rarityDistribution = {
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
    };

    rarityResult.rows.forEach((row: any) => {
      rarityDistribution[row.rarity as keyof typeof rarityDistribution] = parseInt(row.count);
    });

    return res.status(200).json({
      success: true,
      data: {
        coins,
        exclusiveContents,
        coupons,
        gameItems,
        rarityDistribution,
      },
    });

  } catch (error) {
    console.error('Error fetching assets overview:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
