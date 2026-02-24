import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { db } from '../../../lib/db';

// 關閉 Next.js 自動 body parsing，LINE 需要 raw body 做簽名驗證
export const config = {
  api: { bodyParser: false },
};

// 讀取 raw body
function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 驗證 LINE 簽名
function verifySignature(body: Buffer, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.warn('[Webhook] LINE_CHANNEL_SECRET not set, skipping signature verification');
    return true; // 開發階段先跳過
  }
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  return hash === signature;
}

// Postback data 解析：event=witchshop_0305&answer=yes
function parsePostbackData(data: string): Record<string, string> {
  const params: Record<string, string> = {};
  data.split('&').forEach(pair => {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
  });
  return params;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // LINE webhook 只用 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-line-signature'] as string;

    // 簽名驗證
    if (signature && !verifySignature(rawBody, signature)) {
      console.error('[Webhook] Invalid signature');
      return res.status(403).json({ message: 'Invalid signature' });
    }

    const body = JSON.parse(rawBody.toString('utf-8'));
    const events = body.events || [];

    console.log(`[Webhook] Received ${events.length} events`);

    for (const event of events) {
      const lineUserId = event.source?.userId;
      const replyToken = event.replyToken;

      // ===== Postback Event =====
      if (event.type === 'postback' && event.postback?.data) {
        const data = event.postback.data;
        const params = parsePostbackData(data);
        console.log(`[Webhook] Postback from ${lineUserId}:`, params);

        // 存到 DB
        try {
          await db.query(
            `INSERT INTO line_postback_events
             (line_user_id, reply_token, event_type, postback_data, event_name, answer, display_text, raw_event)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              lineUserId,
              replyToken,
              'postback',
              data,
              params.event || null,
              params.answer || null,
              event.postback.params?.text || null,
              JSON.stringify(event),
            ]
          );
        } catch (dbErr) {
          console.error('[Webhook] DB insert failed:', (dbErr as Error).message);
        }

        // ===== 追劇式推播：「繼續」按鈕 =====
        if (params.action === 'next_content' && lineUserId) {
          console.log(`[Webhook] next_content from ${lineUserId}`);
          try {
            // 查詢用戶當前進度
            const progressRes = await db.query(
              'SELECT current_step FROM user_content_progress WHERE line_user_id = $1',
              [lineUserId]
            );
            const currentStep = progressRes.rows.length > 0 ? parseInt(progressRes.rows[0].current_step) : 0;
            const nextStep = currentStep + 1;

            // 內容序列定義（與 dashboard-server.js 同步）
            // 每個 post = 影片 + 文字，一次推播送出
            const CONTENT_STEPS = [
              { step: 1,  segment: 1, type: 'game', round: 1, title: '第一章', subtitle: '你的表情會說什麼？' },
              { step: 2,  segment: 1, type: 'post', title: '第一章・後記 (1/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 3,  segment: 1, type: 'post', title: '第一章・後記 (2/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 4,  segment: 1, type: 'post', title: '第一章・後記 (3/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 5,  segment: 1, type: 'post', title: '第一章・後記 (4/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 6,  segment: 2, type: 'game', round: 2, title: '第二章', subtitle: '（待填）' },
              { step: 7,  segment: 2, type: 'post', title: '第二章・後記 (1/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 8,  segment: 2, type: 'post', title: '第二章・後記 (2/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 9,  segment: 2, type: 'post', title: '第二章・後記 (3/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 10, segment: 2, type: 'post', title: '第二章・後記 (4/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 11, segment: 3, type: 'game', round: 3, title: '第三章', subtitle: '（待填）' },
              { step: 12, segment: 3, type: 'post', title: '第三章・後記 (1/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 13, segment: 3, type: 'post', title: '第三章・後記 (2/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 14, segment: 3, type: 'post', title: '第三章・後記 (3/4)', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
              { step: 15, segment: 3, type: 'post', title: '最終章・完結', text: '（內容待填）', video: null as string | null, thumbnail: null as string | null },
            ];
            const SEGMENTS: Record<number, { unlockDate: string | null }> = { 1: { unlockDate: null }, 2: { unlockDate: null }, 3: { unlockDate: null } };
            const LIFF_URL = 'https://liff.line.me/2009050732-hb4kAF29';

            const stepConfig = CONTENT_STEPS.find(s => s.step === nextStep);

            if (!stepConfig) {
              // 全部看完
              if (replyToken) {
                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: '你已經看完所有內容了！✨ 感謝你的追劇！' }] }),
                });
              }
            } else {
              // 檢查段落是否解鎖
              const segConfig = SEGMENTS[stepConfig.segment];
              const isUnlocked = !segConfig?.unlockDate || new Date() >= new Date(segConfig.unlockDate + 'T00:00:00+08:00');

              if (!isUnlocked) {
                if (replyToken) {
                  await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: '下一章即將解鎖，敬請期待 ⏳' }] }),
                  });
                }
              } else {
                // 建構訊息陣列（可能多則：影片 + Flex）
                const msgs: any[] = [];
                if (stepConfig.type === 'game') {
                  msgs.push({
                    type: 'flex', altText: stepConfig.title + ' - 開始遊戲',
                    contents: { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: [
                      { type: 'box', layout: 'vertical', paddingAll: '40px', backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', contents: [
                        { type: 'text', text: stepConfig.title, weight: 'bold', size: 'xxl', color: '#f72585', align: 'center' },
                        { type: 'text', text: stepConfig.subtitle || '準備好了嗎？', wrap: true, size: 'md', color: '#cccccc', align: 'center', margin: 'lg' }
                      ]},
                      { type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#1a1a2e', contents: [
                        { type: 'button', style: 'primary', color: '#f72585', height: 'md', action: { type: 'uri', label: '開始遊戲 🎮', uri: LIFF_URL + '?round=' + (stepConfig as any).round } }
                      ]}
                    ]}}
                  });
                } else {
                  // 影片訊息
                  if (stepConfig.video) {
                    msgs.push({
                      type: 'video',
                      originalContentUrl: stepConfig.video,
                      previewImageUrl: stepConfig.thumbnail || stepConfig.video
                    });
                  }
                  // Flex：標題 + 文字 + 繼續按鈕
                  const flexBody: any[] = [];
                  flexBody.push({ type: 'box', layout: 'vertical', paddingAll: '20px', backgroundColor: '#1a1a2e', contents: [
                    { type: 'text', text: stepConfig.title, weight: 'bold', size: 'lg', color: '#ffffff' },
                    { type: 'text', text: stepConfig.text || '', wrap: true, size: 'sm', color: '#cccccc', margin: 'md' }
                  ]});
                  flexBody.push({ type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#1a1a2e', contents: [
                    { type: 'button', style: 'primary', color: '#f72585', action: { type: 'postback', label: '繼續 ▶', data: 'action=next_content', displayText: '繼續' } }
                  ]});
                  msgs.push({ type: 'flex', altText: stepConfig.title, contents: { type: 'bubble', size: 'giga', body: { type: 'box', layout: 'vertical', paddingAll: '0px', contents: flexBody } } });
                }

                // Reply with content (msgs 可能 1~2 則)
                if (replyToken) {
                  await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                    body: JSON.stringify({ replyToken, messages: msgs }),
                  });
                }

                // Update progress
                await db.query(
                  `INSERT INTO user_content_progress (line_user_id, current_step, updated_at)
                   VALUES ($1, $2, NOW())
                   ON CONFLICT (line_user_id) DO UPDATE SET current_step = $2, updated_at = NOW()`,
                  [lineUserId, nextStep]
                );
                await db.query(
                  `INSERT INTO push_logs (line_user_id, message_type, status, sent_at, message_content)
                   VALUES ($1, 'drip_content', 'sent', NOW(), $2)`,
                  [lineUserId, 'Step ' + nextStep + ': ' + stepConfig.title]
                ).catch(() => {});

                console.log(`[Webhook] Drip content advanced ${lineUserId} to step ${nextStep}: ${stepConfig.title}`);
              }
            }
          } catch (dripErr) {
            console.error('[Webhook] Drip content error:', (dripErr as Error).message);
          }
        }

        // ===== 購票折扣碼 =====
        if (params.action === 'get_promo_code' && replyToken) {
          console.log(`[Webhook] Promo code request from ${lineUserId}`);
          try {
            const promoFlex = {
              type: 'flex' as const,
              altText: '購票折扣碼：0305JUJU125',
              contents: {
                type: 'bubble',
                body: {
                  type: 'box', layout: 'vertical', spacing: 'lg', paddingAll: '24px', backgroundColor: '#1a1a2e',
                  contents: [
                    { type: 'text', text: '🎫 JUJULING Live 購票', weight: 'bold', size: 'lg', color: '#ff6b8a', align: 'center' },
                    { type: 'text', text: '3/5（四）女巫店', size: 'sm', color: '#cccccc', align: 'center', margin: 'sm' },
                    { type: 'separator', margin: 'lg', color: '#333333' },
                    { type: 'text', text: '折扣碼', size: 'sm', color: '#888888', align: 'center', margin: 'lg' },
                    { type: 'text', text: '0305JUJU125', weight: 'bold', size: 'xxl', color: '#ffffff', align: 'center', margin: 'sm' },
                    { type: 'text', text: '可重複使用 ✓', size: 'xs', color: '#4ecdc4', align: 'center', margin: 'md' },
                    { type: 'text', text: 'ibon 購票無法使用折扣碼', size: 'xs', color: '#ff6b8a', align: 'center', margin: 'sm' },
                  ],
                },
                footer: {
                  type: 'box', layout: 'vertical', paddingAll: '16px', backgroundColor: '#16213e',
                  contents: [
                    { type: 'button', style: 'primary', color: '#ff6b8a', height: 'md',
                      action: { type: 'uri', label: '前往購票', uri: 'https://ticketplus.com.tw/activity/eb0b7f04a98b349b4360bdc48052cf90' } },
                  ],
                },
              },
            };
            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
              body: JSON.stringify({ replyToken, messages: [promoFlex] }),
            });
            console.log(`[Webhook] Promo code reply OK to ${lineUserId}`);
            await db.query(
              `INSERT INTO push_logs (line_user_id, message_type, status, sent_at, message_content)
               VALUES ($1, 'promo_code', 'sent', NOW(), $2)`,
              [lineUserId, '折扣碼卡片: 0305JUJU125 + 購票連結']
            ).catch(() => {});
          } catch (promoErr) {
            console.error('[Webhook] Promo code reply error:', (promoErr as Error).message);
          }
        }

        // 同步更新 users 表
        if (params.event === 'witchshop_0305' && lineUserId) {
          const available = params.answer === 'yes' ? 'yes' : 'no';
          try {
            await db.query(
              `INSERT INTO users (line_user_id, is_available_0305, created_at, updated_at)
               VALUES ($1, $2, NOW(), NOW())
               ON CONFLICT (line_user_id)
               DO UPDATE SET is_available_0305 = $2, updated_at = NOW()`,
              [lineUserId, available]
            );
            console.log(`[Webhook] Updated user ${lineUserId}: is_available_0305 = ${available}`);
          } catch (dbErr) {
            console.error('[Webhook] User update failed:', (dbErr as Error).message);
          }

          // 自動回覆（reply 優先，失敗改 push）
          {
            const replyText = available === 'yes'
              ? '太好了！🎉 我們會在活動前通知你購票資訊，敬請期待！'
              : '沒關係！💌 我們會持續推送精彩內容給你，下次活動見！';
            const replyMsgs = [{ type: 'text', text: replyText }];
            let replied = false;

            if (replyToken) {
              try {
                const rRes = await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ replyToken, messages: replyMsgs }),
                });
                if (rRes.ok) {
                  replied = true;
                  console.log(`[Webhook] Postback reply OK to ${lineUserId}`);
                } else {
                  console.error(`[Webhook] Postback reply FAILED ${rRes.status}: ${await rRes.text()}`);
                }
              } catch (e) {
                console.error('[Webhook] Postback reply error:', (e as Error).message);
              }
            }
            if (!replied && lineUserId) {
              try {
                const pRes = await fetch('https://api.line.me/v2/bot/message/push', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                  body: JSON.stringify({ to: lineUserId, messages: replyMsgs }),
                });
                if (pRes.ok) {
                  replied = true;
                  console.log(`[Webhook] Postback push OK to ${lineUserId}`);
                } else {
                  console.error(`[Webhook] Postback push FAILED ${pRes.status}: ${await pRes.text()}`);
                }
              } catch (e) {
                console.error('[Webhook] Postback push error:', (e as Error).message);
              }
            }
            await db.query(
              `INSERT INTO push_logs (line_user_id, message_type, status, sent_at, message_content)
               VALUES ($1, 'postback_reply', $2, NOW(), $3)`,
              [lineUserId, replied ? 'sent' : 'failed', '3/5有空回覆: ' + available + ' → ' + replyText.slice(0, 80)]
            ).catch(() => {});
          }
        }
      }

      // ===== Follow Event（加好友）=====
      if (event.type === 'follow' && lineUserId) {
        console.log(`[Webhook] New follower: ${lineUserId}`);

        // 1. 用 LINE Profile API 抓 display_name
        let displayName = '';
        try {
          const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
            headers: { 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            displayName = profile.displayName || '';
          }
        } catch (e) {
          console.warn('[Webhook] Profile fetch failed:', (e as Error).message);
        }

        // 2. 記錄 follow event + 確保 users 表有 row（含 display_name）
        try {
          await db.query(
            `INSERT INTO line_postback_events
             (line_user_id, reply_token, event_type, postback_data, raw_event)
             VALUES ($1, $2, 'follow', '', $3)`,
            [lineUserId, replyToken, JSON.stringify(event)]
          );
          await db.query(
            `INSERT INTO users (line_user_id, line_display_name, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             ON CONFLICT (line_user_id)
             DO UPDATE SET line_display_name = COALESCE(NULLIF($2, ''), users.line_display_name), updated_at = NOW()`,
            [lineUserId, displayName]
          );
        } catch (dbErr) {
          console.error('[Webhook] Follow event DB insert failed:', (dbErr as Error).message);
        }

        // 3. 回覆歡迎訊息 + 3/5 有空卡片（reply 優先，失敗則改 push）
        {
          const welcomeMessages = [
            {
              type: 'text',
              text: `歡迎加入！🎬\n\n戀綜125 互動式MV 的所有最新消息，都會在這裡推送給你。\n\nJuju 有些話，只能唱給你聽。`,
            },
            {
              type: 'flex',
              altText: '你 3/5 有空嗎？',
              contents: {
                type: 'bubble',
                body: {
                  type: 'box', layout: 'vertical', spacing: 'lg', paddingAll: '20px', backgroundColor: '#1a1a2e',
                  contents: [
                    { type: 'text', text: '🎬 戀綜125 — 最終章', weight: 'bold', size: 'sm', color: '#f72585' },
                    { type: 'text', text: 'Juju 3/5 在女巫店等你', weight: 'bold', size: 'lg', color: '#ffffff', wrap: true, margin: 'md' },
                    { type: 'text', text: '這些故事的最終章，她留在了 3/5 的女巫店。\n你會在場嗎？', size: 'sm', color: '#cccccc', wrap: true, margin: 'md' },
                  ],
                },
                footer: {
                  type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', backgroundColor: '#16213e',
                  contents: [
                    { type: 'text', text: '你 3/5 有空嗎？', weight: 'bold', size: 'md', color: '#ffffff', align: 'center' },
                    {
                      type: 'box', layout: 'horizontal', spacing: 'md', margin: 'md',
                      contents: [
                        { type: 'button', action: { type: 'postback', label: '✋ 有空！', data: 'event=witchshop_0305&answer=yes', displayText: '我 3/5 有空！想去女巫店 🙋' }, style: 'primary', color: '#f72585', height: 'sm' },
                        { type: 'button', action: { type: 'postback', label: '😢 沒空', data: 'event=witchshop_0305&answer=no', displayText: '我 3/5 沒空，但想收到後續消息 💌' }, style: 'secondary', height: 'sm' },
                      ],
                    },
                  ],
                },
              },
            },
          ];

          let sent = false;
          // 先嘗試 reply
          if (replyToken) {
            try {
              const replyRes = await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({ replyToken, messages: welcomeMessages }),
              });
              if (replyRes.ok) {
                sent = true;
                console.log(`[Webhook] Welcome reply OK for ${lineUserId} (${displayName})`);
              } else {
                const errBody = await replyRes.text();
                console.error(`[Webhook] Welcome reply FAILED ${replyRes.status}: ${errBody}`);
              }
            } catch (replyErr) {
              console.error('[Webhook] Welcome reply error:', (replyErr as Error).message);
            }
          }
          // reply 失敗 → 改用 push
          if (!sent && lineUserId) {
            try {
              const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
                body: JSON.stringify({ to: lineUserId, messages: welcomeMessages }),
              });
              if (pushRes.ok) {
                sent = true;
                console.log(`[Webhook] Welcome push OK for ${lineUserId} (${displayName})`);
              } else {
                const errBody = await pushRes.text();
                console.error(`[Webhook] Welcome push FAILED ${pushRes.status}: ${errBody}`);
              }
            } catch (pushErr) {
              console.error('[Webhook] Welcome push error:', (pushErr as Error).message);
            }
          }
          // 記錄結果
          if (sent) {
            await db.query(
              `INSERT INTO push_logs (line_user_id, message_type, status, sent_at, message_content)
               VALUES ($1, 'follow_welcome', 'sent', NOW(), $2)`,
              [lineUserId, '歡迎訊息 + 3/5有空Flex卡片']
            ).catch(() => {});
          } else {
            await db.query(
              `INSERT INTO push_logs (line_user_id, message_type, status, sent_at, message_content)
               VALUES ($1, 'follow_welcome', 'failed', NOW(), $2)`,
              [lineUserId, 'reply+push都失敗']
            ).catch(() => {});
          }
        }
      }

      // ===== Unfollow Event（封鎖/取消好友）=====
      if (event.type === 'unfollow' && lineUserId) {
        console.log(`[Webhook] Unfollowed: ${lineUserId}`);
        try {
          await db.query(
            `INSERT INTO line_postback_events
             (line_user_id, event_type, postback_data, raw_event)
             VALUES ($1, 'unfollow', '', $2)`,
            [lineUserId, JSON.stringify(event)]
          );
        } catch (dbErr) {
          console.error('[Webhook] Unfollow event DB insert failed:', (dbErr as Error).message);
        }
      }
    }

    // LINE 要求回 200
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
