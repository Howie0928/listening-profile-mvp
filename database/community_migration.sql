-- Discord 風格社群系統資料庫遷移腳本
-- Community System Database Migration Script (Discord-style)
-- 執行順序：在 chat_migration.sql 之後執行

-- 建立 communities 資料表 (社群：藝人社群、遊戲社群)
-- Create communities table (Artist communities, Game communities)
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('artist', 'game')),
    description TEXT,
    avatar_url TEXT,
    member_count INTEGER DEFAULT 0,

    -- 關聯資訊
    artist_id UUID REFERENCES users(id) ON DELETE SET NULL, -- 藝人社群才有
    game_code VARCHAR(50), -- 遊戲社群才有（對應遊戲代碼）

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 確保遊戲社群的 game_code 唯一
    UNIQUE(game_code)
);

-- 建立 channels 資料表 (頻道：公告、閒聊等)
-- Create channels table (Channels: announcements, chat, etc.)
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    channel_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (channel_type IN ('text', 'voice', 'announcement')),
    position INTEGER DEFAULT 0, -- 排序用

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 同一社群內頻道名稱唯一
    UNIQUE(community_id, name)
);

-- 建立 group_messages 資料表 (群組訊息)
-- Create group_messages table
CREATE TABLE IF NOT EXISTS group_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'music', 'system')),
    metadata JSONB, -- 儲存額外資訊（如音樂連結、圖片 URL）

    -- 互動數據
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立 community_members 資料表 (社群成員關係)
-- Create community_members table
CREATE TABLE IF NOT EXISTS community_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- 最後讀取時間（用於未讀訊息計算）

    -- 確保同一用戶在同一社群只有一條記錄
    UNIQUE(community_id, user_id)
);

-- 建立 message_reactions 資料表 (訊息反應：按讚等)
-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like', 'love', 'fire', 'clap')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 同一用戶對同一訊息的同一種反應只能有一個
    UNIQUE(message_id, user_id, reaction_type)
);

-- ============================================
-- 觸發器與函數
-- Triggers and Functions
-- ============================================

-- 更新社群的 updated_at 時間戳
CREATE OR REPLACE FUNCTION update_community_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE communities
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.community_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_community_timestamp ON group_messages;
CREATE TRIGGER trigger_update_community_timestamp
    AFTER INSERT ON group_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_community_timestamp();

-- 更新社群成員數量
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE communities
        SET member_count = member_count + 1
        WHERE id = NEW.community_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE communities
        SET member_count = member_count - 1
        WHERE id = OLD.community_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_member_count_insert ON community_members;
CREATE TRIGGER trigger_update_member_count_insert
    AFTER INSERT ON community_members
    FOR EACH ROW
    EXECUTE FUNCTION update_community_member_count();

DROP TRIGGER IF EXISTS trigger_update_member_count_delete ON community_members;
CREATE TRIGGER trigger_update_member_count_delete
    AFTER DELETE ON community_members
    FOR EACH ROW
    EXECUTE FUNCTION update_community_member_count();

-- 更新訊息的按讚數量
CREATE OR REPLACE FUNCTION update_message_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE group_messages
        SET like_count = like_count + 1
        WHERE id = NEW.message_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE group_messages
        SET like_count = like_count - 1
        WHERE id = OLD.message_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_like_count_insert ON message_reactions;
CREATE TRIGGER trigger_update_like_count_insert
    AFTER INSERT ON message_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_message_like_count();

DROP TRIGGER IF EXISTS trigger_update_like_count_delete ON message_reactions;
CREATE TRIGGER trigger_update_like_count_delete
    AFTER DELETE ON message_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_message_like_count();

-- 遊戲完成後自動加入遊戲社群
CREATE OR REPLACE FUNCTION auto_join_game_community()
RETURNS TRIGGER AS $$
DECLARE
    community_id UUID;
    game_community_name VARCHAR(100);
BEGIN
    -- 只有當遊戲被標記為完成時才執行
    IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
        -- 根據 game_data 中的遊戲代碼查找社群（假設 game_data 有 game_code 欄位）
        -- 這裡暫時先用預設遊戲社群處理

        -- 查找遊戲社群 ID（假設已經有預設的遊戲社群）
        SELECT id INTO community_id
        FROM communities
        WHERE type = 'game' AND game_code = 'rhythm_hell' -- 預設：節奏地獄
        LIMIT 1;

        -- 如果找到社群，自動加入
        IF community_id IS NOT NULL THEN
            INSERT INTO community_members (community_id, user_id, role)
            VALUES (community_id, NEW.user_id, 'member')
            ON CONFLICT (community_id, user_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_join_game_community ON game_sessions;
CREATE TRIGGER trigger_auto_join_game_community
    AFTER UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION auto_join_game_community();

-- ============================================
-- 索引
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_communities_type ON communities(type);
CREATE INDEX IF NOT EXISTS idx_communities_artist_id ON communities(artist_id);
CREATE INDEX IF NOT EXISTS idx_communities_game_code ON communities(game_code);
CREATE INDEX IF NOT EXISTS idx_communities_updated_at ON communities(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_channels_community_id ON channels(community_id);
CREATE INDEX IF NOT EXISTS idx_channels_position ON channels(position);

CREATE INDEX IF NOT EXISTS idx_group_messages_channel_id ON group_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender_id ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_joined_at ON community_members(joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- ============================================
-- 預設資料（測試用）
-- Default Data (for testing)
-- ============================================

-- 創建預設遊戲社群
INSERT INTO communities (name, type, description, game_code, member_count)
VALUES
    ('節奏地獄倖存者', 'game', '完成「節奏地獄」遊戲的玩家社群', 'rhythm_hell', 0),
    ('音符跑酷玩家', 'game', '完成「音符跑酷」遊戲的玩家社群', 'note_runner', 0),
    ('旋律冒險家', 'game', '完成「旋律冒險」遊戲的玩家社群', 'melody_quest', 0)
ON CONFLICT (game_code) DO NOTHING;

-- 為每個遊戲社群創建預設頻道
DO $$
DECLARE
    community RECORD;
BEGIN
    FOR community IN SELECT id FROM communities WHERE type = 'game'
    LOOP
        -- 公告頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '公告', '官方公告與重要訊息', 'announcement', 0)
        ON CONFLICT (community_id, name) DO NOTHING;

        -- 攻略討論頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '攻略討論', '分享遊戲攻略與技巧', 'text', 1)
        ON CONFLICT (community_id, name) DO NOTHING;

        -- 成就炫耀頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '成就炫耀', '展示你的遊戲成就與高分', 'text', 2)
        ON CONFLICT (community_id, name) DO NOTHING;
    END LOOP;
END $$;

-- 創建預設藝人社群（示例）
INSERT INTO communities (name, type, description, member_count)
VALUES
    ('五月天粉絲社群', 'artist', '五月天官方粉絲社群', 0),
    ('周杰倫粉絲社群', 'artist', '周杰倫官方粉絲社群', 0),
    ('茄子蛋粉絲社群', 'artist', '茄子蛋官方粉絲社群', 0)
ON CONFLICT DO NOTHING;

-- 為藝人社群創建預設頻道
DO $$
DECLARE
    community RECORD;
BEGIN
    FOR community IN SELECT id FROM communities WHERE type = 'artist'
    LOOP
        -- 公告頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '公告', '藝人官方公告', 'announcement', 0)
        ON CONFLICT (community_id, name) DO NOTHING;

        -- 閒聊頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '閒聊', '粉絲自由聊天', 'text', 1)
        ON CONFLICT (community_id, name) DO NOTHING;

        -- 音樂分享頻道
        INSERT INTO channels (community_id, name, description, channel_type, position)
        VALUES (community.id, '音樂分享', '分享喜歡的歌曲', 'text', 2)
        ON CONFLICT (community_id, name) DO NOTHING;
    END LOOP;
END $$;
