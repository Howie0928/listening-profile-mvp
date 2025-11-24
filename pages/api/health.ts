import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    message: 'Social Radar, Chat, and User APIs deployed',
    features: ['社交雷達', '聊天系統', '配對請求', '用戶設定', '資產錢包']
  });
}
