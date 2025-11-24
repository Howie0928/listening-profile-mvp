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

    const { status_text, category, lat, lng } = req.body;

    if (!status_text || !category) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        // Delete old status first (one status per user rule)
        await db.query('DELETE FROM user_statuses WHERE user_id = $1', [user.userId]);

        let query = `
      INSERT INTO user_statuses (user_id, status_text, category, location)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
      RETURNING id
    `;
        let params = [user.userId, status_text, category, parseFloat(lng), parseFloat(lat)];

        if (lat === undefined || lng === undefined) {
            // Handle case without location
            query = `
          INSERT INTO user_statuses (user_id, status_text, category)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
            params = [user.userId, status_text, category];
        }

        const result = await db.query(query, params);

        res.status(200).json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
