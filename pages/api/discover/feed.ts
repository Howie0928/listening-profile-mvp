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
        // 1. Social Lane: Get active game lobbies
        const socialQuery = `
      SELECT 
        us.id, 
        us.status_text as title, 
        u.email,
        us.created_at
      FROM user_statuses us
      JOIN users u ON us.user_id = u.id
      WHERE us.category = 'game_lobby' 
      AND us.expires_at > NOW()
      ORDER BY us.created_at DESC
      LIMIT 10
    `;

        const socialRes = await db.query(socialQuery);

        const socialLane = socialRes.rows.map(row => ({
            id: row.id,
            title: row.title,
            creator: row.email.split('@')[0],
            image: `https://api.dicebear.com/7.x/shapes/svg?seed=${row.id}`, // Mock image
            type: 'lobby'
        }));

        // 2. Hero Lane (Mock)
        const heroLane = [
            {
                id: 'hero1',
                title: '情緒音樂遊戲 - JUJU x MJ Lee',
                description: '透過表情創造音樂，體驗前所未有的互動藝術。',
                image: 'https://placehold.co/600x400/1a1a1a/white?text=Emotion+Game',
                action: '/game/emotion'
            },
            {
                id: 'hero2',
                title: '尋找你的聲音靈魂',
                description: 'AI 聲音分析，配對最適合你的音樂夥伴。',
                image: 'https://placehold.co/600x400/2a2a2a/white?text=Voice+Match',
                action: '/game/voice-match'
            }
        ];

        // 3. Recommended Lane (Mock)
        const recommendedLane = [
            { id: 'rec1', title: '大象體操 - 互動MV', image: 'https://placehold.co/300x200/1a1a1a/white?text=Elephant' },
            { id: 'rec2', title: '落日飛車 - 虛擬演唱會', image: 'https://placehold.co/300x200/1a1a1a/white?text=Sunset' },
            { id: 'rec3', title: 'Deca Joins - 散步地圖', image: 'https://placehold.co/300x200/1a1a1a/white?text=Deca' }
        ];

        // 4. Templates Lane (Mock)
        const templatesLane = [
            { id: 'tpl1', title: '製作你的 3D 頭像', category: 'Avatar' },
            { id: 'tpl2', title: '建立虛擬展間', category: 'Space' },
            { id: 'tpl3', title: 'AI 音樂生成器', category: 'Music' }
        ];

        res.status(200).json({
            hero: heroLane,
            social: socialLane,
            recommended: recommendedLane,
            templates: templatesLane
        });

    } catch (error) {
        console.error('Discover feed error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
}
