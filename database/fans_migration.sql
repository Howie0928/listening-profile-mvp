-- 粉絲追蹤系統資料庫遷移
-- Fans Following System Database Migration

-- 建立 artist_fans 資料表（粉絲追蹤關係）
CREATE TABLE IF NOT EXISTS artist_fans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    interaction_count INTEGER DEFAULT 0, -- 互動次數統計
    last_interaction TIMESTAMP WITH TIME ZONE,
    notes TEXT, -- 藝人對粉絲的備註
    tags TEXT[], -- 標籤系統，用於分類粉絲

    -- 確保同一對藝人與粉絲只有一個追蹤關係
    UNIQUE(artist_id, fan_id)
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_artist_fans_artist_id ON artist_fans(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_fans_fan_id ON artist_fans(fan_id);
CREATE INDEX IF NOT EXISTS idx_artist_fans_followed_at ON artist_fans(followed_at DESC);
CREATE INDEX IF NOT EXISTS idx_artist_fans_interaction_count ON artist_fans(interaction_count DESC);

-- 建立觸發器函數：當粉絲發送第一條訊息時自動建立追蹤關係
CREATE OR REPLACE FUNCTION auto_follow_on_first_message()
RETURNS TRIGGER AS $$
DECLARE
    conversation_artist_id UUID;
    conversation_fan_id UUID;
    message_count INTEGER;
BEGIN
    -- 獲取對話的藝人和粉絲ID
    SELECT artist_id, fan_id INTO conversation_artist_id, conversation_fan_id
    FROM conversations
    WHERE id = NEW.conversation_id;

    -- 只處理粉絲發送的訊息
    IF NEW.sender_type = 'fan' THEN
        -- 檢查這是否是粉絲的第一條訊息
        SELECT COUNT(*) INTO message_count
        FROM messages
        WHERE conversation_id = NEW.conversation_id
          AND sender_type = 'fan'
          AND id != NEW.id;

        -- 如果是第一條訊息，建立追蹤關係
        IF message_count = 0 THEN
            INSERT INTO artist_fans (artist_id, fan_id, last_interaction)
            VALUES (conversation_artist_id, conversation_fan_id, NEW.created_at)
            ON CONFLICT (artist_id, fan_id)
            DO UPDATE SET
                interaction_count = artist_fans.interaction_count + 1,
                last_interaction = NEW.created_at;
        ELSE
            -- 更新互動統計
            UPDATE artist_fans
            SET interaction_count = interaction_count + 1,
                last_interaction = NEW.created_at
            WHERE artist_id = conversation_artist_id
              AND fan_id = conversation_fan_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器：新訊息時自動更新粉絲追蹤
DROP TRIGGER IF EXISTS trigger_auto_follow_on_message ON messages;
CREATE TRIGGER trigger_auto_follow_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION auto_follow_on_first_message();

-- 建立視圖：藝人的粉絲統計資訊
CREATE OR REPLACE VIEW artist_fan_stats AS
SELECT
    af.artist_id,
    COUNT(DISTINCT af.fan_id) as total_fans,
    COUNT(DISTINCT CASE
        WHEN af.last_interaction > CURRENT_TIMESTAMP - INTERVAL '7 days'
        THEN af.fan_id
    END) as active_fans_7d,
    COUNT(DISTINCT CASE
        WHEN af.last_interaction > CURRENT_TIMESTAMP - INTERVAL '30 days'
        THEN af.fan_id
    END) as active_fans_30d,
    AVG(af.interaction_count) as avg_interactions,
    MAX(af.last_interaction) as latest_interaction
FROM artist_fans af
GROUP BY af.artist_id;

-- 為既有的對話建立追蹤關係（資料遷移）
INSERT INTO artist_fans (artist_id, fan_id, interaction_count, last_interaction)
SELECT DISTINCT
    c.artist_id,
    c.fan_id,
    COUNT(m.id) as interaction_count,
    MAX(m.created_at) as last_interaction
FROM conversations c
INNER JOIN messages m ON m.conversation_id = c.id
WHERE m.sender_type = 'fan'
GROUP BY c.artist_id, c.fan_id
ON CONFLICT (artist_id, fan_id) DO NOTHING;

-- 建立函數：搜尋粉絲
CREATE OR REPLACE FUNCTION search_fans(
    p_artist_id UUID,
    p_search_term TEXT DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    fan_id UUID,
    fan_name TEXT,
    fan_email TEXT,
    followed_at TIMESTAMP WITH TIME ZONE,
    interaction_count INTEGER,
    last_interaction TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    tags TEXT[],
    last_message TEXT,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH fan_messages AS (
        SELECT DISTINCT ON (c.fan_id)
            c.fan_id,
            m.content as last_message,
            m.created_at as message_time
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.artist_id = p_artist_id
        ORDER BY c.fan_id, m.created_at DESC
    ),
    unread_counts AS (
        SELECT
            c.fan_id,
            COUNT(m.id) as unread_count
        FROM conversations c
        INNER JOIN messages m ON m.conversation_id = c.id
        WHERE c.artist_id = p_artist_id
          AND m.sender_type = 'fan'
          AND (m.metadata->>'read' IS NULL OR m.metadata->>'read' = 'false')
        GROUP BY c.fan_id
    )
    SELECT
        af.fan_id,
        u.username as fan_name,
        u.email as fan_email,
        af.followed_at,
        af.interaction_count,
        af.last_interaction,
        af.notes,
        af.tags,
        fm.last_message,
        COALESCE(uc.unread_count, 0) as unread_count
    FROM artist_fans af
    INNER JOIN users u ON u.id = af.fan_id
    LEFT JOIN fan_messages fm ON fm.fan_id = af.fan_id
    LEFT JOIN unread_counts uc ON uc.fan_id = af.fan_id
    WHERE af.artist_id = p_artist_id
      AND (p_search_term IS NULL OR (
          u.username ILIKE '%' || p_search_term || '%' OR
          u.email ILIKE '%' || p_search_term || '%' OR
          af.notes ILIKE '%' || p_search_term || '%'
      ))
      AND (p_tags IS NULL OR af.tags && p_tags)
    ORDER BY af.last_interaction DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;