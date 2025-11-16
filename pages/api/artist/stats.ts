// pages/api/artist/stats.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return;
  }

  // 1. 驗證請求方法
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. 驗證藝人身份（選用）
    // const user = getUserFromRequest(req);
    // if (!user || user.userId !== '00000000-0000-0000-0000-000000000001') {
    //   return res.status(403).json({ error: 'Forbidden' });
    // }

    // 3. 查詢統計數據
    // 總粉絲數（排除藝人自己）
    const fansResult = await db.query(
      `SELECT COUNT(*) as count FROM users
       WHERE role = 'fan' OR role IS NULL`
    );

    // 總體驗數（檢查 game_results 表是否存在，若不存在則使用 messages 計數）
    let playsCount = 0;
    try {
      const playsResult = await db.query(
        `SELECT COUNT(*) as count FROM game_results`
      );
      playsCount = parseInt(playsResult.rows[0]?.count || '0');
    } catch (error) {
      // game_results 表可能不存在，使用替代方案
      console.log('game_results table not found, using alternative count');
      const alternativeResult = await db.query(
        `SELECT COUNT(DISTINCT conversation_id) as count FROM messages`
      );
      playsCount = parseInt(alternativeResult.rows[0]?.count || '0');
    }

    // 有發送訊息的粉絲數
    const activeUsersResult = await db.query(
      `SELECT COUNT(DISTINCT sender_id) as count
       FROM messages
       WHERE sender_id != '00000000-0000-0000-0000-000000000001'
       AND sender_type = 'fan'`
    );

    // 未讀訊息數（計算來自粉絲的訊息）
    // 注意：messages 表可能沒有 is_read 欄位，使用替代方案
    let unreadCount = 0;
    try {
      const unreadResult = await db.query(
        `SELECT COUNT(*) as count
         FROM messages
         WHERE sender_type = 'fan'`
      );
      // 簡化：將所有來自粉絲的訊息視為需要回覆的
      unreadCount = parseInt(unreadResult.rows[0]?.count || '0');
    } catch (error) {
      console.log('Error counting unread messages:', error);
      unreadCount = 0;
    }

    // 4. 計算訊息互動率
    const totalFans = parseInt(fansResult.rows[0]?.count || '0');
    const activeFans = parseInt(activeUsersResult.rows[0]?.count || '0');
    const messageRate = totalFans > 0
      ? Math.round((activeFans / totalFans) * 100)
      : 0;

    // 5. 回傳結果
    res.status(200).json({
      success: true,
      data: {
        totalFans,
        totalPlays: playsCount,
        messageRate: `${messageRate}%`,
        unreadCount,
        activeFans,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Stats API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}