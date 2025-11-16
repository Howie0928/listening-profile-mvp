import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { getUserFromRequest } from '../../../lib/auth';
import { handleCors } from '../../../lib/cors';

interface CharacterSelectionRequest {
  character_code: string;
}

interface CharacterSelectionResponse {
  success: boolean;
  message: string;
  selectionId?: string;
  characterSelection?: {
    id: string;
    userId: string;
    characterCode: string;
    createdAt: string;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CharacterSelectionResponse>
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

    const { character_code }: CharacterSelectionRequest = req.body;

    if (!character_code || typeof character_code !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Character code is required and must be a string'
      });
    }

    if (character_code.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Character code cannot exceed 50 characters'
      });
    }

    const validCharacterCodes = ['dreamer', 'warrior', 'mystic', 'energetic', 'gentle', 'explorer', 'creator', 'guardian'];
    if (!validCharacterCodes.includes(character_code.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid character code'
      });
    }

    const insertSelectionQuery = `
      INSERT INTO character_selections (user_id, character_code)
      VALUES ($1, $2)
      RETURNING id, user_id, character_code, created_at
    `;

    const result = await db.query(insertSelectionQuery, [
      user.userId,
      character_code.toLowerCase()
    ]);

    const characterSelection = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Character selection saved successfully',
      selectionId: characterSelection.id,
      characterSelection: {
        id: characterSelection.id,
        userId: characterSelection.user_id,
        characterCode: characterSelection.character_code,
        createdAt: characterSelection.created_at
      }
    });

  } catch (error) {
    console.error('Character selection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}