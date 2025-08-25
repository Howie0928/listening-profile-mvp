import type { NextApiRequest, NextApiResponse } from 'next';
// 步驟 1: 引入我們剛剛建立的資料庫「橋樑」
import db from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code || null;

  if (code === null) {
    return res.redirect('/?error=NoCode');
  }

  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri = 'http://127.0.0.1:3000/api/auth/spotify/callback';

  const authHeader = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    // --- 交換 Access Token ---
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;

    // --- 取得使用者資料 ---
    const userProfileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userProfile = await userProfileResponse.json();
    console.log('✅ Spotify User Profile Data:');
    console.log(userProfile);

    // 步驟 2: 將使用者資料寫入資料庫 (UPSERT 邏輯)
    try {
      const query = `
        INSERT INTO users (spotify_id, display_name, email, user_data_json)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (spotify_id) 
        DO UPDATE SET 
          display_name = EXCLUDED.display_name, 
          email = EXCLUDED.email, 
          user_data_json = EXCLUDED.user_data_json,
          updated_at = NOW();
      `;

      const values = [
        userProfile.id,
        userProfile.display_name,
        userProfile.email,
        userProfile, // 將完整的 userProfile 物件存入 jsonb 欄位
      ];
      
      await db.query(query, values);
      
      console.log(`✅ Successfully upserted user data for ${userProfile.display_name} into the database.`);

    } catch (dbError) {
      console.error('❌ Database write error:', dbError);
      // 即使資料庫寫入失敗，我們仍然可以先讓使用者登入成功
      // 在正式產品中，這裡可能需要更完善的錯誤處理
    }
    
    // --- 將使用者導回首頁 ---
    res.redirect(`/?success=true&displayName=${encodeURIComponent(userProfile.display_name)}`);

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    res.redirect('/?error=CallbackError');
  }
}