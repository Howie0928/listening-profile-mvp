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
        const query = `
      SELECT 
        c.id, 
        c.status, 
        c.updated_at,
        CASE 
            WHEN c.artist_id = $1 THEN c.fan_id 
            ELSE c.artist_id 
        END as partner_id,
        u.email as partner_email,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_time,
        c.match_source_id
      FROM conversations c
      JOIN users u ON (CASE WHEN c.artist_id = $1 THEN c.fan_id ELSE c.artist_id END) = u.id
      WHERE c.artist_id = $1 OR c.fan_id = $1
      ORDER BY c.updated_at DESC
    `;

        const result = await db.query(query, [user.userId]);

        const conversations = result.rows.map(row => {
            let category = 'general';
            if (row.status === 'accepted') {
                category = 'primary';
            }

            return {
                id: row.id,
                partner: {
                    id: row.partner_id,
                    name: row.partner_email.split('@')[0],
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.partner_id}`
                },
                lastMessage: row.last_message || (row.status === 'pending' ? 'Sent a match request' : 'Start chatting!'),
                timestamp: row.last_message_time || row.updated_at,
                status: row.status,
                category
            };
        });

        const inbox = {
            primary: conversations.filter(c => c.category === 'primary'),
            general: conversations.filter(c => c.category === 'general')
        };

        res.status(200).json(inbox);
    } catch (error) {
        console.error('Inbox error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
