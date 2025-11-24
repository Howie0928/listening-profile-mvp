-- 社交雷達與社群系統遷移腳本 (v1.1) - 修正版
-- Social Radar & Community System Migration Script (v1.1) - Fix

-- 1. 啟用 PostGIS 擴充套件 (用於地理位置計算)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. 重建 user_statuses 資料表 (即時狀態)
DROP TABLE IF EXISTS user_statuses CASCADE;
CREATE TABLE user_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('ticket', 'party', 'jam', 'idle', 'game_lobby')),
    location GEOGRAPHY(POINT), -- 使用 PostGIS 地理點
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_statuses_location ON user_statuses USING GIST (location);
CREATE INDEX idx_user_statuses_expires_at ON user_statuses(expires_at);
CREATE INDEX idx_user_statuses_category ON user_statuses(category);

-- 3. 重建 user_settings 資料表 (用戶偏好)
DROP TABLE IF EXISTS user_settings CASCADE;
CREATE TABLE user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    search_radius_km INTEGER DEFAULT 50,
    age_range_min INTEGER DEFAULT 18,
    age_range_max INTEGER DEFAULT 35,
    ghost_mode BOOLEAN DEFAULT FALSE, -- 隱身模式
    audio_match_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 修改 conversations 資料表 (加入配對狀態)
-- 使用 DO block 來檢查並新增欄位，避免錯誤
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'status') THEN
        ALTER TABLE conversations ADD COLUMN status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'match_source_id') THEN
        ALTER TABLE conversations ADD COLUMN match_source_id UUID REFERENCES user_statuses(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- 5. 重建 notifications 資料表 (通知系統)
DROP TABLE IF EXISTS notifications CASCADE;
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('match_request', 'match_accepted', 'system_alert', 'game_invite')),
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- 6. 重建 circles 資料表 (創作者群組)
DROP TABLE IF EXISTS circles CASCADE;
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_circles_owner_id ON circles(owner_id);

-- 7. 重建 circle_channels 資料表 (群組頻道)
DROP TABLE IF EXISTS circle_channels CASCADE;
CREATE TABLE circle_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice')),
    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_circle_channels_circle_id ON circle_channels(circle_id);

-- 8. 重建 user_assets 資料表 (資產與票券)
DROP TABLE IF EXISTS user_assets CASCADE;
CREATE TABLE user_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('points', 'voucher', 'item')),
    amount INTEGER DEFAULT 1,
    is_unique BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    obtained_from_game_id UUID REFERENCES game_sessions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX idx_user_assets_type ON user_assets(type);

-- 9. 建立 View
CREATE OR REPLACE VIEW active_user_statuses AS
SELECT *
FROM user_statuses
WHERE expires_at > CURRENT_TIMESTAMP;
