const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 載入環境變數
require('dotenv').config({ path: '.env.local' });

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  try {
    console.log('🔄 執行粉絲追蹤系統遷移...');

    const migrationSQL = fs.readFileSync(path.join(__dirname, 'database', 'fans_migration.sql'), 'utf8');
    await db.query(migrationSQL);

    console.log('✅ 粉絲追蹤系統遷移完成！');

    // 檢查是否成功建立表格
    const checkTables = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('artist_fans', 'conversations', 'messages')
    `);

    console.log('📋 已建立的資料表:', checkTables.rows.map(row => row.table_name));

    await db.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 遷移失敗:', error.message);
    console.error('詳細錯誤:', error);
    await db.end();
    process.exit(1);
  }
}

runMigration();