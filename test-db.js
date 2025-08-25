// test-db.js

// 讓這個獨立腳本也能讀取 .env.local 檔案
require('dotenv').config({ path: './.env.local' });

const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

// 我們直接把 .env.local 的內容印出來，做第一次交叉比對
console.log('讀取到的 DATABASE_URL:', connectionString);

// 建立一個新的連線池
const pool = new Pool({
  connectionString: connectionString,
});

async function testConnection() {
  let client;
  try {
    console.log('------------------------------------');
    console.log('🚀 正在嘗試連接至資料庫...');
    
    // 這一行就是驗證的核心，它會嘗試建立一個連線
    client = await pool.connect();
    
    console.log('✅ 資料庫連線成功！');
    
    // 為了證明連線真的可用，我們執行一個簡單的查詢
    const result = await client.query('SELECT NOW()');
    console.log('🕒 資料庫目前時間:', result.rows[0].now);
    
  } catch (error) {
    // 如果失敗，我們把最原始、最完整的錯誤訊息印出來
    console.error('❌ 資料庫連線失敗！');
    console.error('詳細錯誤資訊:', error);
  } finally {
    // 不論成功或失敗，都確保連線被關閉
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('🔌 連線已關閉。');
    console.log('------------------------------------');
  }
}

// 執行測試
testConnection();