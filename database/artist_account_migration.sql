-- 藝人帳號建立腳本
-- Artist Account Creation Script for 怪奇 (Qzzy)

-- 1. 添加 role 和 artist_name 欄位到 users 表
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'fan' CHECK (role IN ('fan', 'artist'));

ALTER TABLE users
ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255);

-- 2. 刪除現有的系統帳號（如果存在）
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001' OR email = 'guaiqi@system.local';

-- 3. 插入怪奇的藝人帳號
-- 密碼: 123456 的 bcrypt hash (使用 cost factor 10)
INSERT INTO users (
  id,
  email,
  password_hash,
  role,
  artist_name,
  created_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'qzzy@artist.com',
  '$2b$10$YourHashWillGoHere',  -- 需要替換為實際的 hash
  'artist',
  '怪奇',
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  artist_name = EXCLUDED.artist_name;

-- 4. 驗證帳號已建立
SELECT id, email, role, artist_name, created_at
FROM users
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 5. 創建索引以優化查詢
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_artist_name ON users(artist_name);