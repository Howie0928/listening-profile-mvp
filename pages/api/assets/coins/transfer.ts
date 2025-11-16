import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';
import { handleCors } from '../../../../lib/cors';

interface TransferRequest {
  recipient_id?: string;
  amount: number;
  transaction_type: 'earn_game' | 'purchase' | 'spend' | 'gift';
  description?: string;
  related_content_id?: string;
}

interface TransferResponse {
  success: boolean;
  message: string;
  data?: {
    transaction_id: string;
    new_balance: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransferResponse>
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
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const {
      recipient_id,
      amount,
      transaction_type,
      description,
      related_content_id,
    } = req.body as TransferRequest;

    // 驗證輸入
    if (!amount || amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!transaction_type) {
      return res.status(400).json({
        success: false,
        message: 'Transaction type required'
      });
    }

    // 開始資料庫交易
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // 如果是消費或贈送，檢查餘額
      if (['spend', 'gift'].includes(transaction_type)) {
        const balanceResult = await client.query(
          'SELECT balance FROM coin_balances WHERE user_id = $1',
          [user.id]
        );

        const currentBalance = balanceResult.rows[0]?.balance || 0;

        if (currentBalance < Math.abs(amount)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Insufficient balance'
          });
        }
      }

      // 計算正確的金額符號
      let finalAmount = amount;
      if (['spend', 'gift'].includes(transaction_type)) {
        finalAmount = -Math.abs(amount);
      } else {
        finalAmount = Math.abs(amount);
      }

      // 取得當前餘額
      const balanceResult = await client.query(
        'SELECT balance FROM coin_balances WHERE user_id = $1',
        [user.id]
      );
      const currentBalance = balanceResult.rows[0]?.balance || 0;
      const newBalance = currentBalance + finalAmount;

      // 插入交易記錄（觸發器會自動更新餘額）
      const transactionResult = await client.query(
        `INSERT INTO coin_transactions
         (user_id, amount, balance_after, transaction_type, description, related_content_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [user.id, finalAmount, newBalance, transaction_type, description, related_content_id]
      );

      const transactionId = transactionResult.rows[0].id;

      // 如果是贈送，為接收者創建交易
      if (transaction_type === 'gift' && recipient_id) {
        await client.query(
          `INSERT INTO coin_transactions
           (user_id, amount, balance_after, transaction_type, description)
           VALUES ($1, $2, (SELECT balance FROM coin_balances WHERE user_id = $1) + $2, $3, $4)`,
          [recipient_id, Math.abs(amount), 'gift_received', `來自 ${user.email} 的禮物`]
        );
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Transaction completed',
        data: {
          transaction_id: transactionId,
          new_balance: newBalance,
        },
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error processing coin transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
