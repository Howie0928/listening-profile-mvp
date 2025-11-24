import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const user = getUserFromRequest(req);
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        // 1. Get user settings
        const settingsRes = await db.query(
            'SELECT * FROM user_settings WHERE user_id = $1',
            [user.userId]
        );
        const settings = settingsRes.rows[0] || { search_radius_km: 50, ghost_mode: false };

        // 2. Check Ghost Mode
        if (settings.ghost_mode) {
            return res.status(200).json({
                users: [],
                message: 'Ghost mode enabled. You cannot see others.'
            });
        }

        // 3. Get nearby users
        const { lat, lng } = req.query;

        let query = `
      SELECT 
        us.id, 
        us.user_id, 
        us.status_text, 
        us.category, 
        us.expires_at,
        u.email,
        ST_X(us.location::geometry) as lng,
        ST_Y(us.location::geometry) as lat
      FROM user_statuses us
      JOIN users u ON us.user_id = u.id
      WHERE us.expires_at > NOW()
      AND us.user_id != $1
    `;

        const params: any[] = [user.userId];

        // Add distance filter if lat/lng provided
        if (lat && lng) {
            query += ` AND ST_DWithin(
            us.location, 
            ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, 
            $4 * 1000
        )`;
            params.push(parseFloat(lng as string), parseFloat(lat as string), settings.search_radius_km);
        }

        query += ` ORDER BY us.created_at DESC LIMIT 50`;

        const result = await db.query(query, params);

        const users = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            status: row.status_text,
            category: row.category,
            location: { lat: row.lat, lng: row.lng },
            name: row.email.split('@')[0], // Mock name from email
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id}` // Mock avatar
        }));

        res.status(200).json({ users });
    } catch (error) {
        console.error('Radar error:', error);
        // Fallback if PostGIS fails or other error
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
