import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface GameCompleteRequest {
  score: number;
  character_selection_id?: string;
  game_data?: any;
}

interface GameCompleteResponse {
  success: boolean;
  message: string;
  sessionId?: string;
  gameSession?: {
    id: string;
    userId: string;
    score: number;
    characterSelectionId?: string;
    gameData?: any;
    completedAt: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GameCompleteResponse>
) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return; // 預檢請求已處理
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { score, character_selection_id, game_data }: GameCompleteRequest = req.body;

    if (typeof score !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Score must be a number'
      });
    }

    if (score < 0) {
      return res.status(400).json({
        success: false,
        message: 'Score cannot be negative'
      });
    }

    if (character_selection_id && typeof character_selection_id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Character selection ID must be a string'
      });
    }

    const insertSessionQuery = `
      INSERT INTO game_sessions (user_id, character_selection_id, score, game_data, is_completed)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, user_id, character_selection_id, score, game_data, completed_at, is_completed
    `;

    const result = await db.query(insertSessionQuery, [
      user.userId,
      character_selection_id || null,
      score,
      game_data ? JSON.stringify(game_data) : null
    ]);

    const gameSession = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Game session completed successfully',
      sessionId: gameSession.id,
      gameSession: {
        id: gameSession.id,
        userId: gameSession.user_id,
        score: gameSession.score,
        characterSelectionId: gameSession.character_selection_id,
        gameData: gameSession.game_data,
        completedAt: gameSession.completed_at
      }
    });

  } catch (error) {
    console.error('Game completion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}