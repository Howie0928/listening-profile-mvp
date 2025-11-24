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

    const { conversation_id, action } = req.body;

    if (!conversation_id || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ message: 'Invalid parameters' });
    }

    try {
        const convRes = await db.query(
            'SELECT * FROM conversations WHERE id = $1 AND (artist_id = $2 OR fan_id = $2)',
            [conversation_id, user.userId]
        );

        if (convRes.rows.length === 0) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const conv = convRes.rows[0];

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';

        await db.query(
            'UPDATE conversations SET status = $1, updated_at = NOW() WHERE id = $2',
            [newStatus, conversation_id]
        );

        if (newStatus === 'accepted') {
            const partnerId = conv.artist_id === user.userId ? conv.fan_id : conv.artist_id;

            await db.query(
                `INSERT INTO notifications (recipient_id, sender_id, type, title, body, data)
             VALUES ($1, $2, 'match_accepted', '配對成功！', '對方接受了你的請求，開始聊天吧！', $3)`,
                [
                    partnerId,
                    user.userId,
                    JSON.stringify({ conversation_id: conversation_id })
                ]
            );
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Approve match error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
