import type { NextApiRequest, NextApiResponse } from 'next';
import querystring from 'querystring';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const scope = 'user-read-private user-read-email user-top-read';
  // 注意！這裡要用 127.0.0.1 來匹配 Spotify 儀表板的設定
  const redirect_uri = 'http://127.0.0.1:3000/api/auth/spotify/callback';

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID,
      scope: scope,
      redirect_uri: redirect_uri,
    }));
}