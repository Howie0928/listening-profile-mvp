/**
 * 執行資料庫 Migration 腳本
 * 用途：將 posts_migration.sql 匯入 Supabase PostgreSQL
 * 執行：node scripts/run-migration.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
    console.log('🚀 開始執行 Migration...\n');

    // 讀取 SQL 文件
    const sqlFilePath = path.join(__dirname, '../database/posts_migration.sql');

    if (!fs.existsSync(sqlFilePath)) {
        console.error('❌ 錯誤：找不到 SQL 文件');
        console.error(`   路徑：${sqlFilePath}`);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`📄 已讀取 SQL 文件：${sqlFilePath}`);
    console.log(`📊 SQL 文件大小：${(sqlContent.length / 1024).toFixed(2)} KB\n`);

    // 連接資料庫
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        console.log('🔌 連接到 Supabase 資料庫...');
        await client.connect();
        console.log('✅ 資料庫連接成功\n');

        console.log('⚙️  開始執行 SQL Migration...');
        console.log('=' .repeat(60));

        // 執行 SQL
        const result = await client.query(sqlContent);

        console.log('=' .repeat(60));
        console.log('\n✅ Migration 執行成功！\n');

        // 驗證結果
        console.log('🔍 驗證新建表格...');
        const tables = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN (
                'artist_posts', 'games', 'badges', 'user_badges',
                'post_reactions', 'post_comments', 'notifications', 'music_similarity'
            )
            ORDER BY table_name;
        `);

        console.log(`\n📊 已創建表格數量：${tables.rows.length} / 8`);
        tables.rows.forEach((row, index) => {
            console.log(`   ${index + 1}. ${row.table_name}`);
        });

        // 檢查測試數據
        const postCount = await client.query('SELECT COUNT(*) FROM artist_posts');
        console.log(`\n📝 測試消息數量：${postCount.rows[0].count} 條`);

        if (tables.rows.length === 8 && parseInt(postCount.rows[0].count) >= 5) {
            console.log('\n🎉 所有檢查通過，Migration 完成！');
            console.log('✅ 可以開始開發 API 了');
        } else {
            console.warn('\n⚠️  警告：Migration 可能未完全執行');
        }

    } catch (error) {
        console.error('\n❌ Migration 執行失敗：');
        console.error(error.message);

        // 詳細錯誤資訊
        if (error.position) {
            console.error(`\n錯誤位置：第 ${error.position} 字元`);
        }
        if (error.detail) {
            console.error(`詳細資訊：${error.detail}`);
        }

        process.exit(1);
    } finally {
        await client.end();
        console.log('\n🔌 資料庫連接已關閉');
    }
}

// 執行
runMigration().catch(err => {
    console.error('💥 未預期的錯誤：', err);
    process.exit(1);
});
