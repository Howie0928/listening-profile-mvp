// 運行社群系統資料庫 Migration 腳本
// Run Community System Database Migration Script

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🚀 開始運行社群系統 Migration...\n');

  // 檢查環境變數
  if (!process.env.DATABASE_URL) {
    console.error('❌ 錯誤：找不到 DATABASE_URL 環境變數');
    console.error('請確認 .env.local 檔案存在且包含 DATABASE_URL');
    process.exit(1);
  }

  // 建立資料庫連線
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    // 讀取 SQL 檔案
    const sqlPath = path.join(__dirname, '../database/community_migration.sql');
    console.log(`📄 讀取 SQL 檔案：${sqlPath}\n`);

    if (!fs.existsSync(sqlPath)) {
      throw new Error('找不到 community_migration.sql 檔案');
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 執行 SQL
    console.log('⚙️  執行 SQL 腳本...\n');
    await pool.query(sql);

    console.log('✅ Migration 執行成功！\n');
    console.log('已建立的表格：');
    console.log('  - communities（社群）');
    console.log('  - channels（頻道）');
    console.log('  - group_messages（群組訊息）');
    console.log('  - community_members（成員關係）');
    console.log('  - message_reactions（訊息反應）\n');

    console.log('已建立的預設資料：');
    console.log('  - 3 個遊戲社群（節奏地獄、音符跑酷、旋律冒險）');
    console.log('  - 3 個藝人社群（五月天、周杰倫、茄子蛋）');
    console.log('  - 每個社群都有 3 個預設頻道\n');

    // 驗證資料
    console.log('🔍 驗證資料...\n');
    const communitiesResult = await pool.query('SELECT COUNT(*) FROM communities');
    const channelsResult = await pool.query('SELECT COUNT(*) FROM channels');

    console.log(`✅ 社群數量：${communitiesResult.rows[0].count}`);
    console.log(`✅ 頻道數量：${channelsResult.rows[0].count}\n`);

    console.log('🎉 全部完成！可以開始開發前端了！');

  } catch (error) {
    console.error('❌ Migration 執行失敗：', error.message);
    console.error('\n詳細錯誤：', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
