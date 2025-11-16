import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'healthy',
    version: '1.1.0-spotify-removed',
    timestamp: new Date().toISOString(),
    message: 'Spotify OAuth pages have been removed'
  });
}
