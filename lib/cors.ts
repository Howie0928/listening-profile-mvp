import type { NextApiRequest, NextApiResponse } from 'next';

export function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin || '';

  // 允許的來源清單
  const allowedOrigins = [
    'http://localhost:3004',
    'http://localhost:3000',
    'http://127.0.0.1:3004',
    'http://127.0.0.1:3000',
    'http://192.168.1.111:3000',
    'https://listening-profile-frontend.vercel.app',
  ];

  // ngrok 和 Vercel 預覽網址的正規表示式
  const ngrokPattern = /https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/;
  const vercelPattern = /https:\/\/listening-profile-frontend-[a-zA-Z0-9]+-howue-yus-projects\.vercel\.app/;

  // 檢查並設置 Access-Control-Allow-Origin
  if (allowedOrigins.includes(origin) || ngrokPattern.test(origin) || vercelPattern.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // 如果有 origin 但不在允許清單，記錄但不設置（安全考量）
    console.warn('[CORS] Origin not in allowlist:', origin);
  } else {
    // 如果沒有 origin header（某些工具測試），允許任何來源（僅限開發/測試）
    // 生產環境應該始終有 origin header
    res.setHeader('Access-Control-Allow-Origin', 'https://listening-profile-frontend.vercel.app');
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