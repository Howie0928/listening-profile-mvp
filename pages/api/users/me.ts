// pages/api/users/me.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { analyzeListeningProfile, AnalysisResult } from '../../../lib/analysis';

// 這裡我們需要一個方法來從資料庫拿到使用者的 access token
// 由於我們還沒寫完整的 session 機制，我們先用一個「假」的 token 來測試
// 【重要】上線前務必換成真實的資料庫查詢！
async function getAccessTokenForUser(req: NextApiRequest): Promise<string> {
  // 這裡應該是去資料庫撈...
  // 現在為了測試，我們先直接從環境變數讀一個你自己的測試用 token
  // 你可以從 Spotify Developer 的 Console 頁面手動產生一個
  const FAKE_TEST_TOKEN = process.env.SPOTIFY_TEST_TOKEN;
  
  if (!FAKE_TEST_TOKEN) {
    throw new Error("請在 .env.local 中設定 SPOTIFY_TEST_TOKEN 變數以便測試");
  }

  return FAKE_TEST_TOKEN;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResult | { error: string }>
) {
  try {
    const accessToken = await getAccessTokenForUser(req);
    const result = await analyzeListeningProfile(accessToken);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}