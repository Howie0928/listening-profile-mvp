import { Pool } from 'pg';

// 宣告一個全域變數來存放我們的連線池
// 這是為了在 Next.js 的開發模式 (hot-reloading) 中，避免重複建立過多的連線池
declare global {
  var pgPool: Pool | undefined;
}

let db: Pool;

// 檢查 process.env.DATABASE_URL 是否存在，如果不存在就拋出錯誤
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// 防止在開發模式下重複建立連線池
if (process.env.NODE_ENV === 'development') {
  if (!global.pgPool) {
    global.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // 你的 Supabase 資料庫需要 SSL 連線
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  db = global.pgPool;
} else {
  // 在生產環境中，直接建立連線池
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

export default db;