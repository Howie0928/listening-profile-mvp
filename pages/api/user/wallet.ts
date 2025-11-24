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
        const assetsRes = await db.query(
            'SELECT * FROM user_assets WHERE user_id = $1 ORDER BY created_at DESC',
            [user.userId]
        );

        const points = assetsRes.rows
            .filter(a => a.type === 'points')
            .reduce((sum, a) => sum + a.amount, 0);

        const vouchers = assetsRes.rows.filter(a => a.type === 'voucher');
        const items = assetsRes.rows.filter(a => a.type === 'item');

        res.status(200).json({
            points,
            vouchers,
            items
        });
    } catch (error) {
        console.error('Wallet error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
