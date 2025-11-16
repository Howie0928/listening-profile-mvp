-- ============================================
-- 個人資產系統資料庫遷移
-- 創建日期: 2025-11-15
-- 整合: Weverse + LYSN + Roblox 概念
-- ============================================

-- ============================================
-- 1. 藝人專屬內容表
-- ============================================
CREATE TABLE IF NOT EXISTS artist_exclusive_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- 內容基本資訊
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL, -- 'photocard', 'demo', 'video', 'voice', 'message', 'coupon'

  -- 檔案資訊
  file_url TEXT,
  thumbnail_url TEXT,

  -- 稀有度系統（參考 Fortnite）
  rarity TEXT NOT NULL DEFAULT 'common', -- 'legendary', 'epic', 'rare', 'common'

  -- 限量與供應
  total_supply INT, -- 總發行量（null = 無限量）
  current_supply INT DEFAULT 0, -- 已發出數量
  is_limited BOOLEAN DEFAULT FALSE,

  -- 解鎖條件（JSON 格式）
  unlock_condition JSONB DEFAULT '{}'::jsonb,

  -- 時間限制
  release_date TIMESTAMP DEFAULT NOW(),
  expiry_date TIMESTAMP, -- 到期日（優惠券用）

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_contents_artist ON artist_exclusive_contents(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_contents_rarity ON artist_exclusive_contents(rarity);
CREATE INDEX IF NOT EXISTS idx_artist_contents_type ON artist_exclusive_contents(content_type);

-- ============================================
-- 2. 用戶收藏表
-- ============================================
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES artist_exclusive_contents(id) ON DELETE CASCADE,

  -- 獲得方式
  obtained_method TEXT NOT NULL, -- 'game_reward', 'purchase', 'gift', 'event', 'subscription'
  obtained_from TEXT, -- 來源描述
  obtained_at TIMESTAMP DEFAULT NOW(),

  -- 使用狀態（優惠券用）
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,

  -- 個人化
  is_favorited BOOLEAN DEFAULT FALSE,

  -- 防止重複收藏
  UNIQUE(user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_content ON user_collections(content_id);

-- ============================================
-- 3. 代幣系統（AT Coins）
-- ============================================
CREATE TABLE IF NOT EXISTS coin_balances (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance INT DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned INT DEFAULT 0,
  lifetime_spent INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  amount INT NOT NULL, -- 正數=獲得，負數=消費
  balance_after INT NOT NULL,

  transaction_type TEXT NOT NULL, -- 'earn_game', 'purchase', 'spend', 'gift'

  -- 關聯資訊
  related_content_id UUID REFERENCES artist_exclusive_contents(id) ON DELETE SET NULL,
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

-- ============================================
-- 4. 觸發器 - 自動更新代幣餘額
-- ============================================
CREATE OR REPLACE FUNCTION update_coin_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- 確保用戶有餘額記錄
  INSERT INTO coin_balances (user_id, balance, lifetime_earned, lifetime_spent)
  VALUES (NEW.user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 更新餘額
  UPDATE coin_balances
  SET
    balance = balance + NEW.amount,
    lifetime_earned = CASE WHEN NEW.amount > 0 THEN lifetime_earned + NEW.amount ELSE lifetime_earned END,
    lifetime_spent = CASE WHEN NEW.amount < 0 THEN lifetime_spent + ABS(NEW.amount) ELSE lifetime_spent END,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_coin_balance ON coin_transactions;
CREATE TRIGGER trigger_update_coin_balance
AFTER INSERT ON coin_transactions
FOR EACH ROW
EXECUTE FUNCTION update_coin_balance();

-- ============================================
-- 5. 觸發器 - 限量內容供應管理
-- ============================================
CREATE OR REPLACE FUNCTION check_limited_content_supply()
RETURNS TRIGGER AS $$
DECLARE
  content_record RECORD;
BEGIN
  SELECT * INTO content_record
  FROM artist_exclusive_contents
  WHERE id = NEW.content_id AND is_limited = TRUE;

  IF FOUND THEN
    IF content_record.current_supply >= content_record.total_supply THEN
      RAISE EXCEPTION '此內容已售罄（% / %）',
        content_record.current_supply, content_record.total_supply;
    END IF;

    UPDATE artist_exclusive_contents
    SET current_supply = current_supply + 1
    WHERE id = NEW.content_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_limited_supply ON user_collections;
CREATE TRIGGER trigger_check_limited_supply
BEFORE INSERT ON user_collections
FOR EACH ROW
EXECUTE FUNCTION check_limited_content_supply();

-- ============================================
-- 6. 初始化測試資料
-- ============================================

-- 測試用藝人專屬內容（需要實際的 artist_id）
-- INSERT INTO artist_exclusive_contents (
--   artist_id,
--   title,
--   description,
--   content_type,
--   rarity,
--   total_supply,
--   unlock_condition
-- ) VALUES
-- (
--   '實際的藝人UUID',
--   '阿信親筆簽名數位卡',
--   '2025 年限定版',
--   'photocard',
--   'legendary',
--   100,
--   '{"type": "game_clear", "game_name": "溫柔", "min_score": 90}'::jsonb
-- );

-- ============================================
-- 完成！
-- ============================================
