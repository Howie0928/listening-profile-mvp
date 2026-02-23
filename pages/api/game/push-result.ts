import type { NextApiRequest, NextApiResponse } from 'next';
import { handleCors } from '../../../lib/cors';
import { getUserFromRequest } from '../../../lib/auth';
import { db } from '../../../lib/db';

const VALID_EMOTIONS = ['joy', 'happy', 'chill', 'angry', 'sad', 'chaos'] as const;
type Emotion = typeof VALID_EMOTIONS[number];

// Rate limit: 同一用戶同類型推播的最短間隔（秒）
const RATE_LIMIT_SECONDS = 60;

// 情緒對應的 emoji 和主色（chill 和 happy 共用同一組設定）
const EMOTION_CONFIG: Record<Emotion, { emoji: string; color: string; resultImage: string }> = {
  joy:   { emoji: '\u2728',     color: '#FFD700', resultImage: 'result_joy.png' },
  happy: { emoji: '\uD83C\uDF89', color: '#f72585', resultImage: 'result_happy.png' },
  chill: { emoji: '\uD83C\uDF89', color: '#f72585', resultImage: 'result_chill.png' },
  angry: { emoji: '\uD83D\uDD25', color: '#e63946', resultImage: 'result_angry.png' },
  sad:   { emoji: '\uD83D\uDCA7', color: '#457b9d', resultImage: 'result_sad.png' },
  chaos: { emoji: '\uD83C\uDF00', color: '#7209b7', resultImage: 'result_chaos.png' },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // --- 環境變數檢查 ---
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    return res.status(500).json({ success: false, message: 'LINE_CHANNEL_ACCESS_TOKEN not configured' });
  }

  try {
    // --- 1. JWT 認證（優先）或 fallback 到 userId ---
    let lineUserId: string | null = null;
    let dbUserId: string | null = null;
    let displayName: string | null = null;

    const user = getUserFromRequest(req);
    if (user) {
      // JWT 驗證成功：從 token 取 lineUserId
      dbUserId = user.userId;
      const userRow = await db.query(
        'SELECT line_user_id, line_display_name FROM users WHERE id = $1',
        [dbUserId]
      );
      if (userRow.rows.length > 0) {
        lineUserId = userRow.rows[0].line_user_id;
        displayName = userRow.rows[0].line_display_name;
      }
    }

    // Fallback: 如果 JWT 沒帶或沒有 lineUserId，接受 body 中的 userId
    // （向後相容舊版前端，未來可移除）
    if (!lineUserId && req.body.userId) {
      lineUserId = req.body.userId;
      console.warn('[push-result] Using userId from request body (no JWT). Consider upgrading frontend.');
    }

    if (!lineUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide JWT token or userId.'
      });
    }

    // --- 2. 驗證請求參數 ---
    const { emotion, title, body: messageBody, juJuMessage, juJuVideoUrl, juJuVideoPreview, eventFlex } = req.body;

    if (!emotion || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: emotion, title'
      });
    }

    if (!VALID_EMOTIONS.includes(emotion)) {
      return res.status(400).json({
        success: false,
        message: `Invalid emotion: ${emotion}. Must be one of: ${VALID_EMOTIONS.join(', ')}`
      });
    }

    // --- 3. Rate limit 檢查（DB 失敗時跳過，不阻斷推播） ---
    try {
      const rateLimitCheck = await db.query(
        `SELECT id, sent_at FROM push_logs
         WHERE line_user_id = $1
           AND message_type = 'game_result'
           AND status = 'sent'
         ORDER BY sent_at DESC LIMIT 1`,
        [lineUserId]
      );

      if (rateLimitCheck.rows.length > 0) {
        const lastSent = new Date(rateLimitCheck.rows[0].sent_at);
        const secondsSince = (Date.now() - lastSent.getTime()) / 1000;
        if (secondsSince < RATE_LIMIT_SECONDS) {
          return res.status(429).json({
            success: false,
            message: `Rate limited. Please wait ${Math.ceil(RATE_LIMIT_SECONDS - secondsSince)} seconds.`
          });
        }
      }
    } catch (dbError) {
      console.warn('[push-result] Rate limit check failed (DB may be down), skipping:', (dbError as Error).message);
    }

    // --- 4. 寫入遊戲記錄 (liff_game_sessions) ---
    let sessionId: string | null = null;
    try {
      const sessionResult = await db.query(
        `INSERT INTO liff_game_sessions (user_id, line_user_id, round1_emotion, game_data)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          dbUserId,
          lineUserId,
          emotion,
          JSON.stringify({ emotion, title, body: messageBody, pushed_at: new Date().toISOString() })
        ]
      );
      sessionId = sessionResult.rows[0].id;
    } catch (dbError) {
      // DB 寫入失敗不阻斷推播
      console.error('[push-result] Failed to save game session:', dbError);
    }

    // --- 5. 建立推播記錄（pending，含內容摘要） ---
    let pushLogId: string | null = null;
    const contentParts: string[] = [`[${emotion}] ${title}`];
    if (messageBody) contentParts.push(messageBody.slice(0, 100));
    if (juJuMessage) contentParts.push('JuJu: ' + juJuMessage.slice(0, 80));
    if (juJuVideoUrl) contentParts.push('Video: ' + juJuVideoUrl);
    if (eventFlex) contentParts.push('EventFlex: ' + (eventFlex.altText || 'attached'));
    const messageContent = contentParts.join(' | ');
    try {
      const logResult = await db.query(
        `INSERT INTO push_logs (user_id, line_user_id, message_type, emotion, session_id, status, message_content)
         VALUES ($1, $2, 'game_result', $3, $4, 'pending', $5)
         RETURNING id`,
        [dbUserId, lineUserId, emotion, sessionId, messageContent]
      );
      pushLogId = logResult.rows[0].id;
    } catch (dbError) {
      console.error('[push-result] Failed to create push log:', dbError);
    }

    // --- 6. 組裝 Flex Message ---
    const config = EMOTION_CONFIG[emotion as Emotion];
    const liffUrl = `https://liff.line.me/${process.env.LIFF_ID || '2009050732-hb4kAF29'}`;
    const gameBaseUrl = 'https://juju-emotion-game.vercel.app';
    const resultImageUrl = `${gameBaseUrl}/assets/round1/${config.resultImage}`;

    const greeting = displayName ? `${displayName}，` : '';
    const bodyText = messageBody
      || '感謝你的參與！想看看不同選擇會帶來什麼結局嗎？';

    const flexMessage = {
      type: 'flex' as const,
      altText: `${config.emoji} ${title} - 戀綜125互動式MV`,
      contents: {
        type: 'bubble' as const,
        size: 'giga' as const,
        hero: {
          type: 'image' as const,
          url: resultImageUrl,
          size: 'full' as const,
          aspectRatio: '1.91:1' as const,
          aspectMode: 'cover' as const,
        },
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          spacing: 'md' as const,
          paddingAll: '20px' as const,
          contents: [
            {
              type: 'text' as const,
              text: '戀綜125 互動式MV',
              weight: 'bold' as const,
              size: 'xs' as const,
              color: config.color,
            },
            {
              type: 'text' as const,
              text: `${config.emoji} ${title}`,
              weight: 'bold' as const,
              size: 'xl' as const,
              wrap: true,
              margin: 'sm' as const,
            },
            {
              type: 'text' as const,
              text: `${greeting}${bodyText}`.slice(0, 300),
              size: 'sm' as const,
              color: '#888888',
              wrap: true,
              margin: 'md' as const,
            },
          ],
        },
        footer: {
          type: 'box' as const,
          layout: 'vertical' as const,
          spacing: 'sm' as const,
          paddingAll: '15px' as const,
          contents: [
            {
              type: 'button' as const,
              action: {
                type: 'uri' as const,
                label: '再玩一次！',
                uri: liffUrl,
              },
              style: 'primary' as const,
              color: config.color,
              height: 'sm' as const,
            },
            {
              type: 'button' as const,
              action: {
                type: 'uri' as const,
                label: '分享給朋友',
                uri: liffUrl,
              },
              style: 'secondary' as const,
              height: 'sm' as const,
            },
          ],
        },
      },
    };

    // --- 7. 組裝所有訊息（最多 5 則） ---
    const messages: any[] = [flexMessage];

    // JUJU 的獨立文字訊息
    if (juJuMessage) {
      messages.push({
        type: 'text',
        text: juJuMessage,
      });
    }

    // JUJU 的影片
    if (juJuVideoUrl) {
      messages.push({
        type: 'video',
        originalContentUrl: juJuVideoUrl,
        previewImageUrl: juJuVideoPreview || juJuVideoUrl,
      });
    }

    // 活動宣傳 Flex（從前端 promo-config.js 傳入）
    if (eventFlex && eventFlex.type === 'flex' && eventFlex.contents) {
      messages.push(eventFlex);
    }

    // --- 8. 呼叫 LINE Push Message API ---
    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: messages.slice(0, 5), // LINE 限制最多 5 則
      }),
    });

    const lineRequestId = lineResponse.headers.get('x-line-request-id') || null;

    if (!lineResponse.ok) {
      const errorData = await lineResponse.json().catch(() => ({}));
      console.error('[push-result] LINE API error:', lineResponse.status, errorData);

      // 更新推播記錄為失敗
      if (pushLogId) {
        await db.query(
          `UPDATE push_logs SET status = 'failed', error_message = $1, line_request_id = $2 WHERE id = $3`,
          [JSON.stringify(errorData).slice(0, 500), lineRequestId, pushLogId]
        ).catch(() => {});
      }

      return res.status(lineResponse.status).json({
        success: false,
        message: errorData.message || 'LINE Push Message failed',
      });
    }

    // --- 9. 更新推播記錄為成功 ---
    if (pushLogId) {
      await db.query(
        `UPDATE push_logs SET status = 'sent', sent_at = NOW(), line_request_id = $1 WHERE id = $2`,
        [lineRequestId, pushLogId]
      ).catch(() => {});
    }

    console.log(`[push-result] Pushed ${emotion} result to ${lineUserId} (request: ${lineRequestId})`);

    return res.status(200).json({
      success: true,
      emotion,
      sessionId,
      lineRequestId,
    });

  } catch (error) {
    console.error('[push-result] Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
