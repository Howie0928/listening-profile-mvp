const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  try {
    console.log('🔍 檢查怪奇帳戶...');
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', ['00000000-0000-0000-0000-000000000001']);
    console.log('怪奇帳戶:', userResult.rows);

    console.log('\n📞 檢查對話...');
    const conversations = await db.query('SELECT * FROM conversations WHERE artist_id = $1', ['00000000-0000-0000-0000-000000000001']);
    console.log('怪奇的對話數量:', conversations.rows.length);
    conversations.rows.forEach((conv, i) => {
      console.log(`對話 ${i + 1}:`, {
        id: conv.id,
        fan_id: conv.fan_id,
        created_at: conv.created_at
      });
    });

    console.log('\n💬 檢查訊息...');
    const messages = await db.query(`
      SELECT m.*, u.email as fan_email
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE c.artist_id = $1
      ORDER BY m.created_at ASC
    `, ['00000000-0000-0000-0000-000000000001']);

    console.log('怪奇相關的訊息數量:', messages.rows.length);
    messages.rows.forEach((msg, i) => {
      console.log(`訊息 ${i + 1}:`, {
        content: msg.content,
        sender_type: msg.sender_type,
        fan_email: msg.fan_email,
        created_at: msg.created_at
      });
    });

    console.log('\n👥 檢查粉絲追蹤...');
    const fans = await db.query(`
      SELECT af.*, u.email as fan_email
      FROM artist_fans af
      JOIN users u ON u.id = af.fan_id
      WHERE af.artist_id = $1
    `, ['00000000-0000-0000-0000-000000000001']);

    console.log('怪奇的粉絲數量:', fans.rows.length);
    fans.rows.forEach((fan, i) => {
      console.log(`粉絲 ${i + 1}:`, {
        fan_email: fan.fan_email,
        followed_at: fan.followed_at,
        interaction_count: fan.interaction_count
      });
    });

    await db.end();
  } catch (error) {
    console.error('Error:', error);
    await db.end();
  }
}

checkDatabase();