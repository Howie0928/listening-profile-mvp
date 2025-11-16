import type { NextApiRequest, NextApiResponse } from 'next';
import { handleCors } from '../../../lib/cors';

// 通用 CORS 處理器，用於處理動態路由的 OPTIONS 請求
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 處理所有 OPTIONS 請求
  if (handleCors(req, res)) {
    return; // OPTIONS 請求已處理
  }

  // 對於非 OPTIONS 請求，返回 404
  return res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
}