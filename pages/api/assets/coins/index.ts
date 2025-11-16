import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';
import { handleCors } from '../../../../lib/cors';

interface CoinsResponse {
  success: boolean;
  message?: string;
  data?: {
    balance: number;
    lifetime_earned: number;
    lifetime_spent: number;
    recent_transactions: Array<{
      id: string;
      amount: number;
      type: string;
      description: string;
      created_at: string;
    }>;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CoinsResponse>
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
    const balanceResult = await db.query(
      'SELECT balance, lifetime_earned, lifetime_spent FROM coin_balances WHERE user_id = $1',
      [user.id]
    );

    const balance = balanceResult.rows[0] || {
      balance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
    };

    // 取得最近 10 筆交易記錄
    const transactionsResult = await db.query(
      `SELECT id, amount, transaction_type, description, created_at
       FROM coin_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [user.id]
    );

    const recent_transactions = transactionsResult.rows.map((row: any) => ({
      id: row.id,
      amount: row.amount,
      type: row.transaction_type,
      description: row.description || '',
      created_at: row.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        balance: balance.balance,
        lifetime_earned: balance.lifetime_earned,
        lifetime_spent: balance.lifetime_spent,
        recent_transactions,
      },
    });

  } catch (error) {
    console.error('Error fetching coins data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
