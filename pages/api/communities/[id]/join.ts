// API: 加入社群
// POST /api/communities/[id]/join
import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../../lib/db';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 驗證 JWT Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授權' });
    }

    const token = authHeader.substring(7);
    let decoded: any;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: '無效的 token' });
    }

    const userId = decoded.userId;
    const { id: communityId } = req.query;

    // 檢查社群是否存在
    const communityResult = await db.query(
      'SELECT id, name FROM communities WHERE id = $1',
      [communityId]
    );

    if (communityResult.rows.length === 0) {
      return res.status(404).json({ error: '社群不存在' });
    }

    // 加入社群（如果已加入則忽略）
    await db.query(
      `INSERT INTO community_members (community_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (community_id, user_id) DO NOTHING`,
      [communityId, userId]
    );

    return res.status(200).json({
      message: '成功加入社群',
      community: communityResult.rows[0],
    });
  } catch (error) {
    console.error('加入社群錯誤:', error);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
