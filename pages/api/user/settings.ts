import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = getUserFromRequest(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { search_radius_km, age_range_min, age_range_max, ghost_mode, audio_match_enabled } = req.body;

    try {
        const query = `
      INSERT INTO user_settings (user_id, search_radius_km, age_range_min, age_range_max, ghost_mode, audio_match_enabled, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        search_radius_km = EXCLUDED.search_radius_km,
        age_range_min = EXCLUDED.age_range_min,
        age_range_max = EXCLUDED.age_range_max,
        ghost_mode = EXCLUDED.ghost_mode,
        audio_match_enabled = EXCLUDED.audio_match_enabled,
        updated_at = NOW()
    `;

        await db.query(query, [
            user.userId,
            search_radius_km || 50,
            age_range_min || 18,
            age_range_max || 35,
            ghost_mode || false,
            audio_match_enabled || true
        ]);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
