import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface UserProfileResponse {
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    createdAt: string;
    latestCharacterCode?: string;
    latestCharacterSelection?: {
      id: string;
      characterCode: string;
      createdAt: string;
    };
    gameStatistics: {
      totalGames: number;
      highestScore: number;
      averageScore: number;
      lastPlayedAt?: string;
      characterChoicesCount: number;
      favoriteCharacter?: string;
      recentGames: Array<{
        id: string;
        score: number;
        characterCode?: string;
        completedAt: string;
      }>;
    };
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UserProfileResponse>
) {
  // 處理 CORS
  if (handleCors(req, res)) {
    return; // 預檢請求已處理
  }

  if (req.method !== 'GET') {
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

    const userQuery = `
      SELECT
        u.id,
        u.email,
        u.created_at,
        cs.id as latest_selection_id,
        cs.character_code as latest_character_code,
        cs.created_at as latest_selection_created_at
      FROM users u
      LEFT JOIN character_selections cs ON cs.user_id = u.id
      WHERE u.id = $1
      ORDER BY cs.created_at DESC
      LIMIT 1
    `;

    const userResult = await db.query(userQuery, [user.userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userResult.rows[0];

    // 遊戲統計數據查詢
    const gameStatisticsQuery = `
      SELECT
        COUNT(*) as total_games,
        COALESCE(MAX(score), 0) as highest_score,
        COALESCE(ROUND(AVG(score), 2), 0) as average_score,
        MAX(completed_at) as last_played_at
      FROM game_sessions
      WHERE user_id = $1
    `;
    const gameStatsResult = await db.query(gameStatisticsQuery, [user.userId]);
    const gameStats = gameStatsResult.rows[0];

    // 角色選擇統計
    const characterStatsQuery = `
      SELECT
        COUNT(*) as character_choices_count,
        character_code,
        COUNT(character_code) as choice_count
      FROM character_selections
      WHERE user_id = $1
      GROUP BY character_code
      ORDER BY choice_count DESC
      LIMIT 1
    `;
    const characterStatsResult = await db.query(characterStatsQuery, [user.userId]);
    const characterChoicesCountQuery = `
      SELECT COUNT(*) as total_choices
      FROM character_selections
      WHERE user_id = $1
    `;
    const characterCountResult = await db.query(characterChoicesCountQuery, [user.userId]);

    const favoriteCharacter = characterStatsResult.rows.length > 0 ?
      characterStatsResult.rows[0].character_code : undefined;
    const characterChoicesCount = parseInt(characterCountResult.rows[0].total_choices);

    // 最近遊戲記錄
    const recentGamesQuery = `
      SELECT
        gs.id,
        gs.score,
        gs.completed_at,
        cs.character_code
      FROM game_sessions gs
      LEFT JOIN character_selections cs ON gs.character_selection_id = cs.id
      WHERE gs.user_id = $1
      ORDER BY gs.completed_at DESC
      LIMIT 5
    `;
    const recentGamesResult = await db.query(recentGamesQuery, [user.userId]);

    const response = {
      success: true,
      message: 'User profile retrieved successfully',
      user: {
        id: userData.id,
        email: userData.email,
        createdAt: userData.created_at,
        latestCharacterCode: userData.latest_character_code || undefined,
        latestCharacterSelection: userData.latest_character_code ? {
          id: userData.latest_selection_id,
          characterCode: userData.latest_character_code,
          createdAt: userData.latest_selection_created_at
        } : undefined,
        gameStatistics: {
          totalGames: parseInt(gameStats.total_games),
          highestScore: parseInt(gameStats.highest_score),
          averageScore: parseFloat(gameStats.average_score),
          lastPlayedAt: gameStats.last_played_at || undefined,
          characterChoicesCount,
          favoriteCharacter,
          recentGames: recentGamesResult.rows.map(game => ({
            id: game.id,
            score: game.score,
            characterCode: game.character_code || undefined,
            completedAt: game.completed_at
          }))
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}