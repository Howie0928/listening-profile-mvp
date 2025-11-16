-- 聊天系統資料庫遷移腳本
-- Chat System Database Migration Script
-- 執行順序：在 init.sql 之後執行

-- 建立 conversations 資料表 (對話關係)
-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 確保同一對藝人與粉絲只有一個對話
    UNIQUE(artist_id, fan_id)
);

-- 建立 messages 資料表 (聊天訊息)
-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('artist', 'fan')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'music', 'system')),
    metadata JSONB, -- 用於儲存音樂資訊等額外數據
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 擴展 game_sessions 資料表，增加完成狀態標記
-- Extend game_sessions table with completion status
ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS chat_triggered BOOLEAN DEFAULT FALSE;

-- 建立用於更新 conversations.updated_at 的觸發器函數
-- Create trigger function to update conversations.updated_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器：當新增訊息時自動更新對話的 updated_at
-- Create trigger to auto-update conversation timestamp on new message
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- 建立索引以提升查詢效能
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_artist_id ON conversations(artist_id);
CREATE INDEX IF NOT EXISTS idx_conversations_fan_id ON conversations(fan_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);

CREATE INDEX IF NOT EXISTS idx_game_sessions_is_completed ON game_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_game_sessions_chat_triggered ON game_sessions(chat_triggered);

-- 插入系統預設藝人賬戶 (怪奇)
-- Insert default artist account (怪奇)
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'guaiqi@system.local',
    '$2b$10$placeholder.hash.for.system.account', -- 系統賬戶，不用於登入
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- 建立用於遊戲完成後自動觸發聊天的函數
-- Create function to auto-trigger chat after game completion
CREATE OR REPLACE FUNCTION trigger_game_completion_chat()
RETURNS TRIGGER AS $$
DECLARE
    conversation_id UUID;
    artist_id UUID := '00000000-0000-0000-0000-000000000001'::UUID; -- 怪奇的 ID
BEGIN
    -- 只有當遊戲被標記為完成且尚未觸發聊天時才執行
    IF NEW.is_completed = TRUE AND OLD.chat_triggered = FALSE THEN
        -- 查找或建立與怪奇的對話
        INSERT INTO conversations (artist_id, fan_id)
        VALUES (artist_id, NEW.user_id)
        ON CONFLICT (artist_id, fan_id)
        DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id INTO conversation_id;

        -- 如果上面的 INSERT 沒有返回 ID（因為衝突），則查詢現有的對話
        IF conversation_id IS NULL THEN
            SELECT id INTO conversation_id
            FROM conversations
            WHERE artist_id = artist_id AND fan_id = NEW.user_id;
        END IF;

        -- 發送系統祝賀訊息
        INSERT INTO messages (
            conversation_id,
            sender_id,
            sender_type,
            content,
            message_type,
            metadata
        ) VALUES (
            conversation_id,
            artist_id,
            'artist',
            '恭喜你完成了遊戲！🎉 這是專屬於你的音樂推薦，希望你會喜歡！',
            'system',
            jsonb_build_object(
                'game_session_id', NEW.id,
                'score', NEW.score,
                'trigger_type', 'game_completion'
            )
        );

        -- 標記聊天已觸發
        NEW.chat_triggered = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 建立觸發器：遊戲完成時自動觸發聊天
-- Create trigger for auto-chat on game completion
DROP TRIGGER IF EXISTS trigger_game_completion_chat ON game_sessions;
CREATE TRIGGER trigger_game_completion_chat
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_game_completion_chat();