import type { NextApiRequest, NextApiResponse } from 'next';

export function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  // 允許的來源
  const allowedOrigins = [
    'http://localhost:3004',
    'http://localhost:3000',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3000',
    'http://192.168.1.111:3000', // 新增手機存取
    'https://listening-profile-frontend.vercel.app', // Vercel 生產環境
  ];

  // ngrok 臨時網址的正規表示式
  const ngrokPattern = /https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/;

  // Vercel 預覽網址的正規表示式（包含所有部署）
  const vercelPattern = /https:\/\/listening-profile-frontend-[a-zA-Z0-9]+-howue-yus-projects\.vercel\.app/;

  const origin = req.headers.origin;

  // 檢查來源是否在允許清單中，或符合 ngrok/Vercel 網址格式
  if (origin && (allowedOrigins.includes(origin) || ngrokPattern.test(origin) || vercelPattern.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // 設定其他 CORS 標頭
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24小時預檢快取
}

export function handleCors(req: NextApiRequest, res: NextApiResponse): boolean {
  setCorsHeaders(req, res);

  // 處理預檢請求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // 表示已處理預檢請求
  }

  return false; // 表示需要繼續處理其他邏輯
}