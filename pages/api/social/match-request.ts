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

    const { target_status_id } = req.body;

    if (!target_status_id) {
        return res.status(400).json({ message: 'Missing target_status_id' });
    }

    try {
        // 1. Get target status info
        const statusRes = await db.query(
            'SELECT user_id, status_text FROM user_statuses WHERE id = $1',
            [target_status_id]
        );

        if (statusRes.rows.length === 0) {
            return res.status(404).json({ message: 'Status not found or expired' });
        }

        const targetUserId = statusRes.rows[0].user_id;
        const statusText = statusRes.rows[0].status_text;

        if (targetUserId === user.userId) {
            return res.status(400).json({ message: 'Cannot match with yourself' });
        }

        // 2. Check existing conversation or request within 24h
        const existingConv = await db.query(
            `SELECT id, status, updated_at FROM conversations 
         WHERE ((artist_id = $1 AND fan_id = $2) OR (artist_id = $2 AND fan_id = $1))
         AND updated_at > NOW() - INTERVAL '24 hours'`,
            [user.userId, targetUserId]
        );

        if (existingConv.rows.length > 0) {
            return res.status(400).json({ message: 'Request already sent recently' });
        }

        const client = await db.connect();
        try {
            await client.query('BEGIN');

            // Check if ANY conversation exists between these two (regardless of time)
            const anyConv = await client.query(
                `SELECT id FROM conversations 
             WHERE (artist_id = $1 AND fan_id = $2) OR (artist_id = $2 AND fan_id = $1)`,
                [targetUserId, user.userId]
            );

            let conversationId;

            if (anyConv.rows.length > 0) {
                conversationId = anyConv.rows[0].id;
                await client.query(
                    `UPDATE conversations 
                 SET status = 'pending', match_source_id = $2, updated_at = NOW() 
                 WHERE id = $1`,
                    [conversationId, target_status_id]
                );
            } else {
                // Create new conversation
                // Mapping: target -> artist_id, sender -> fan_id (arbitrary)
                const insertConv = `
                INSERT INTO conversations (artist_id, fan_id, status, match_source_id)
                VALUES ($1, $2, 'pending', $3)
                RETURNING id
            `;
                const res = await client.query(insertConv, [targetUserId, user.userId, target_status_id]);
                conversationId = res.rows[0].id;
            }

            // 4. Create Notification
            await client.query(
                `INSERT INTO notifications (recipient_id, sender_id, type, title, body, data)
             VALUES ($1, $2, 'match_request', '收到配對請求', $3, $4)`,
                [
                    targetUserId,
                    user.userId,
                    `有人對你的狀態 "${statusText}" 感興趣！`,
                    JSON.stringify({ conversation_id: conversationId, status_id: target_status_id })
                ]
            );

            await client.query('COMMIT');
            res.status(200).json({ success: true, conversationId });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Match request error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
