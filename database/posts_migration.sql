-- ============================================
-- 聽覺的東西社群平台 - 消息系統 Migration
-- 創建日期: 2025-11-16
-- 版本: 1.0
-- 描述: 創建消息、遊戲、徽章、通知等核心表格
-- ============================================

-- 1️⃣ 藝人動態表 (artist_posts)
-- 用途: 儲存平台官方公告、遊戲挑戰、藝人動態
CREATE TABLE IF NOT EXISTS artist_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 內容欄位
    title VARCHAR(200) NOT NULL,                    -- 標題
    content TEXT NOT NULL,                          -- 內容（支援 Markdown）
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'video', 'audio', 'none')),
    media_url TEXT,                                 -- 媒體檔案 URL
    thumbnail_url TEXT,                             -- 縮圖 URL

    -- 類型標籤
    post_type VARCHAR(30) NOT NULL CHECK (post_type IN (
        'announcement',        -- 平台公告
        'game_challenge',      -- 遊戲挑戰
        'artist_update',       -- 藝人動態
        'surprise'             -- 驚喜內容
    )),
    author_type VARCHAR(20) NOT NULL CHECK (author_type IN (
        'system',              -- 系統
        'admin',               -- 管理員
        'artist'               -- 藝人
    )),
    author_id UUID REFERENCES users(id),            -- 發布者 ID（藝人/管理員）
    author_name VARCHAR(100),                       -- 發布者名稱顯示

    -- 遊戲挑戰專屬欄位
    game_id UUID,                                   -- 關聯遊戲 ID（若為挑戰類型）
    challenge_deadline TIMESTAMP WITH TIME ZONE,    -- 挑戰截止時間
    reward_badge_id UUID,                           -- 獎勵徽章 ID

    -- 互動統計
    likes_count INTEGER DEFAULT 0,                  -- 按讚數
    comments_count INTEGER DEFAULT 0,               -- 留言數
    shares_count INTEGER DEFAULT 0,                 -- 分享數
    views_count INTEGER DEFAULT 0,                  -- 觀看數

    -- 狀態管理
    is_pinned BOOLEAN DEFAULT FALSE,                -- 是否置頂
    is_published BOOLEAN DEFAULT TRUE,              -- 是否發布
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_artist_posts_type ON artist_posts(post_type);
CREATE INDEX idx_artist_posts_published ON artist_posts(published_at DESC) WHERE is_published = TRUE;
CREATE INDEX idx_artist_posts_author ON artist_posts(author_id);
CREATE INDEX idx_artist_posts_game ON artist_posts(game_id) WHERE game_id IS NOT NULL;

-- 自動更新時間戳
CREATE OR REPLACE FUNCTION update_artist_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_artist_posts_updated_at
BEFORE UPDATE ON artist_posts
FOR EACH ROW EXECUTE FUNCTION update_artist_posts_updated_at();


-- 2️⃣ 遊戲清單表 (games)
-- 用途: 儲存所有可玩遊戲的資訊
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 基本資訊
    name VARCHAR(100) NOT NULL,                     -- 遊戲名稱
    slug VARCHAR(100) UNIQUE NOT NULL,              -- URL 友善名稱
    description TEXT,                               -- 遊戲描述
    cover_image_url TEXT,                           -- 封面圖片

    -- 遊戲屬性
    difficulty VARCHAR(20) CHECK (difficulty IN ('easy', 'medium', 'hard')),
    estimated_time_minutes INTEGER,                 -- 預估遊戲時間（分鐘）
    category VARCHAR(50),                           -- 遊戲分類

    -- Unity 整合
    unity_build_url TEXT,                           -- Unity WebGL Build URL
    unity_version VARCHAR(20),                      -- Unity 版本號

    -- 遊戲狀態
    is_active BOOLEAN DEFAULT TRUE,                 -- 是否啟用
    release_date TIMESTAMP WITH TIME ZONE,          -- 上線日期

    -- 統計資料
    total_plays INTEGER DEFAULT 0,                  -- 總遊玩次數
    average_score NUMERIC(5, 2),                    -- 平均分數
    completion_rate NUMERIC(5, 2),                  -- 完成率（百分比）

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_games_slug ON games(slug);
CREATE INDEX idx_games_active ON games(is_active);
CREATE INDEX idx_games_category ON games(category);

-- 自動更新時間戳
CREATE TRIGGER trigger_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW EXECUTE FUNCTION update_artist_posts_updated_at();


-- 3️⃣ 徽章系統表 (badges)
-- 用途: 儲存所有徽章類型與獎勵
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 徽章資訊
    name VARCHAR(100) NOT NULL,                     -- 徽章名稱
    description TEXT,                               -- 徽章描述
    icon_url TEXT,                                  -- 徽章圖示 URL

    -- 徽章等級
    tier VARCHAR(20) CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'special')),
    rarity VARCHAR(20) CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),

    -- 解鎖條件
    unlock_condition_type VARCHAR(50) CHECK (unlock_condition_type IN (
        'game_completion',     -- 完成遊戲
        'high_score',          -- 達成分數
        'challenge_winner',    -- 挑戰獲勝
        'streak',              -- 連續天數
        'special_event'        -- 特殊活動
    )),
    unlock_condition_value JSONB,                   -- 條件參數（JSON 格式）

    -- 徽章狀態
    is_active BOOLEAN DEFAULT TRUE,
    is_limited_edition BOOLEAN DEFAULT FALSE,       -- 是否限量
    max_recipients INTEGER,                         -- 最大獲得人數（限量專用）
    current_recipients INTEGER DEFAULT 0,           -- 當前獲得人數

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_badges_tier ON badges(tier);
CREATE INDEX idx_badges_rarity ON badges(rarity);
CREATE INDEX idx_badges_active ON badges(is_active);

-- 自動更新時間戳
CREATE TRIGGER trigger_badges_updated_at
BEFORE UPDATE ON badges
FOR EACH ROW EXECUTE FUNCTION update_artist_posts_updated_at();


-- 4️⃣ 用戶徽章表 (user_badges)
-- 用途: 記錄用戶獲得的徽章
CREATE TABLE IF NOT EXISTS user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關聯
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,

    -- 獲得資訊
    earned_from_game_id UUID REFERENCES games(id),          -- 來自哪個遊戲
    earned_from_post_id UUID REFERENCES artist_posts(id),   -- 來自哪個挑戰
    score_achieved INTEGER,                                 -- 達成分數

    -- 狀態
    is_displayed BOOLEAN DEFAULT TRUE,                     -- 是否在個人檔案顯示
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：一個用戶不能重複獲得同一徽章
    UNIQUE(user_id, badge_id)
);

-- 索引
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX idx_user_badges_earned_at ON user_badges(earned_at DESC);


-- 5️⃣ 動態按讚表 (post_reactions)
-- 用途: 記錄用戶對動態的按讚
CREATE TABLE IF NOT EXISTS post_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關聯
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES artist_posts(id) ON DELETE CASCADE,

    -- 反應類型（未來可擴充多種 emoji）
    reaction_type VARCHAR(20) DEFAULT 'like' CHECK (reaction_type IN (
        'like', 'love', 'fire', 'clap', 'heart'
    )),

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：一個用戶對一則動態只能按一次讚
    UNIQUE(user_id, post_id)
);

-- 索引
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX idx_post_reactions_created ON post_reactions(created_at DESC);


-- 6️⃣ 動態留言表 (post_comments)
-- 用途: 記錄用戶對動態的留言
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 關聯
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES artist_posts(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE, -- 支援回覆留言

    -- 內容
    content TEXT NOT NULL,

    -- 互動統計
    likes_count INTEGER DEFAULT 0,

    -- 狀態
    is_deleted BOOLEAN DEFAULT FALSE,                       -- 軟刪除
    is_pinned BOOLEAN DEFAULT FALSE,                        -- 是否置頂（藝人可置頂）

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_post_comments_post ON post_comments(post_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_post_comments_user ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_post_comments_created ON post_comments(created_at DESC);

-- 自動更新時間戳
CREATE TRIGGER trigger_post_comments_updated_at
BEFORE UPDATE ON post_comments
FOR EACH ROW EXECUTE FUNCTION update_artist_posts_updated_at();


-- 7️⃣ 推播通知表 (notifications)
-- 用途: 儲存用戶通知記錄
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 接收者
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 通知內容
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'new_post',            -- 新動態發布
        'challenge_start',     -- 挑戰開始
        'challenge_ending',    -- 挑戰即將結束
        'badge_earned',        -- 獲得徽章
        'artist_mention',      -- 被藝人提名
        'comment_reply',       -- 留言回覆
        'like_milestone'       -- 按讚里程碑
    )),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- 關聯資源
    related_post_id UUID REFERENCES artist_posts(id) ON DELETE SET NULL,
    related_badge_id UUID REFERENCES badges(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- 動作連結
    action_url TEXT,                                        -- 點擊後跳轉 URL

    -- 狀態
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- 時間戳記
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);


-- 8️⃣ 音樂品味相似度表 (music_similarity)
-- 用途: 儲存用戶之間的音樂品味相似度（未來整合 Spotify）
CREATE TABLE IF NOT EXISTS music_similarity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 兩位用戶
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 相似度分數
    similarity_score NUMERIC(5, 2) CHECK (similarity_score >= 0 AND similarity_score <= 100),

    -- 共同資料
    common_artists JSONB,                                   -- 共同喜愛的藝人
    common_genres JSONB,                                    -- 共同喜愛的曲風
    common_games_completed JSONB,                           -- 共同完成的遊戲

    -- 時間戳記
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一約束：避免重複計算（user_id_1 < user_id_2）
    UNIQUE(user_id_1, user_id_2),
    CHECK (user_id_1 < user_id_2)
);

-- 索引
CREATE INDEX idx_music_similarity_user1 ON music_similarity(user_id_1);
CREATE INDEX idx_music_similarity_user2 ON music_similarity(user_id_2);
CREATE INDEX idx_music_similarity_score ON music_similarity(similarity_score DESC);

-- 自動更新時間戳
CREATE TRIGGER trigger_music_similarity_updated_at
BEFORE UPDATE ON music_similarity
FOR EACH ROW EXECUTE FUNCTION update_artist_posts_updated_at();


-- ============================================
-- 測試數據插入（5 條初始消息）
-- ============================================

-- 測試用管理員用戶（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@audible-thing.com') THEN
        INSERT INTO users (email, artist_name, password_hash, role, created_at)
        VALUES ('admin@audible-thing.com', '聽覺的東西官方', 'placeholder_hash', 'artist', NOW());
    END IF;
END $$;

-- 獲取管理員 ID
DO $$
DECLARE
    admin_id UUID;
BEGIN
    SELECT id INTO admin_id FROM users WHERE email = 'admin@audible-thing.com';

    -- 1. 平台歡迎公告
    INSERT INTO artist_posts (
        title, content, post_type, author_type, author_id, author_name,
        media_type, is_pinned, published_at
    ) VALUES (
        '歡迎來到聽覺的東西 🎵',
        E'嗨！歡迎加入「聽覺的東西」社群！\n\n這裡不只是聽音樂的地方，更是**認識音樂知音**的空間。\n\n透過你的 Spotify 聆聽數據，我們會幫你：\n✨ 生成專屬音樂側寫\n🎮 解鎖客製化音樂遊戲\n👥 遇見和你一樣「聽懂」音樂的人\n\n**現在就開始探索吧！**',
        'announcement', 'system', admin_id, '聽覺的東西官方',
        'none', TRUE, NOW()
    );

    -- 2. 第一個遊戲挑戰
    INSERT INTO artist_posts (
        title, content, post_type, author_type, author_id, author_name,
        media_type, challenge_deadline, published_at
    ) VALUES (
        '🎮 首週限時挑戰：音樂節奏大師',
        E'**挑戰內容：**\n在「音樂節奏大師」遊戲中達成 80 分以上\n\n**獎勵：**\n🏆 專屬徽章「初代玩家」\n✨ 解鎖隱藏音樂側寫報告\n\n**倒數時間：** 48 小時\n\n立即挑戰，證明你的音感！',
        'game_challenge', 'admin', admin_id, '聽覺的東西官方',
        'image', NOW() + INTERVAL '48 hours', NOW() - INTERVAL '1 hour'
    );

    -- 3. 驚喜內容
    INSERT INTO artist_posts (
        title, content, post_type, author_type, author_id, author_name,
        media_type, published_at
    ) VALUES (
        '🎁 驚喜揭曉：本週最受歡迎歌曲',
        E'根據所有用戶的聆聽數據分析...\n\n本週社群最愛的前三首歌是：\n\n🥇 **孤勇者** - 陳奕迅\n🥈 **如果聲音不記得** - 吳青峰\n🥉 **刻在我心底的名字** - 盧廣仲\n\n你也聽過這些歌嗎？快來分享你的音樂品味！',
        'surprise', 'admin', admin_id, '聽覺的東西官方',
        'none', NOW() - INTERVAL '2 hours'
    );

    -- 4. 藝人動態模擬
    INSERT INTO artist_posts (
        title, content, post_type, author_type, author_id, author_name,
        media_type, published_at
    ) VALUES (
        '謝謝大家的支持 💙',
        E'看到這麼多人完成了音樂挑戰，真的超級感動！\n\n你們的熱情讓我想到...\n也許下次可以一起線上同步聽歌？\n\n如果有 50 個人以上想參加，我們就來辦！\n在底下留言 +1 吧 🙌',
        'artist_update', 'artist', admin_id, '余昊益',
        'none', NOW() - INTERVAL '5 hours'
    );

    -- 5. 系統更新公告
    INSERT INTO artist_posts (
        title, content, post_type, author_type, author_id, author_name,
        media_type, published_at
    ) VALUES (
        '🔔 系統更新通知',
        E'**更新內容：**\n\n✅ 新增「音樂知音配對」功能\n✅ 優化遊戲載入速度\n✅ 修復部分顯示問題\n\n感謝所有測試用戶的回饋！\n\n有任何問題歡迎回報 💬',
        'announcement', 'system', admin_id, '聽覺的東西官方',
        'none', NOW() - INTERVAL '1 day'
    );

    RAISE NOTICE '✅ 成功插入 5 條測試消息';
END $$;


-- ============================================
-- Migration 完成檢查
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
    post_count INTEGER;
BEGIN
    -- 檢查表格數量
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'artist_posts', 'games', 'badges', 'user_badges',
        'post_reactions', 'post_comments', 'notifications', 'music_similarity'
    );

    -- 檢查測試數據
    SELECT COUNT(*) INTO post_count FROM artist_posts;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migration 執行完成！';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 創建表格數量: % / 8', table_count;
    RAISE NOTICE '📝 測試消息數量: %', post_count;
    RAISE NOTICE '========================================';

    IF table_count = 8 AND post_count >= 5 THEN
        RAISE NOTICE '🎉 所有檢查通過，可以開始開發 API！';
    ELSE
        RAISE WARNING '⚠️  請檢查 Migration 是否完全執行';
    END IF;
END $$;
