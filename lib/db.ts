// lib/db.ts

import { Pool } from 'pg';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: '.env.local' });

// 宣告一個全域變數來存放我們的連線池
let db: Pool;

// 確保 DATABASE_URL 存在
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not defined in environment variables');
  console.error('Please check .env.local file');
  throw new Error('DATABASE_URL is required');
}

// 這種寫法可以確保在開發環境中，不會因為熱重載 (Hot Reload) 而建立多個不必要的連線池
if (process.env.NODE_ENV === 'production') {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
} else {
  // @ts-ignore
  if (!global.db) {
    // @ts-ignore
    global.db = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  // @ts-ignore
  db = global.db;
}

// 測試連接
db.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export { db };
