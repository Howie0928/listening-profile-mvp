const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const db = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    try {
        console.log('🚀 開始執行社交雷達遷移腳本...');

        const sqlPath = path.join(__dirname, '../database/social_radar_migration.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📄 讀取 SQL 檔案:', sqlPath);

        await db.query(sql);

        console.log('✅ 遷移成功！資料庫已更新。');
    } catch (error) {
        console.error('❌ 遷移失敗:', error);
    } finally {
        await db.end();
    }
}

runMigration();
