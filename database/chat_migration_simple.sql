-- 聊天系統資料庫遷移腳本（簡化版）
-- Chat System Database Migration Script (Simplified)

-- 1. 建立 conversations 資料表 (對話關係)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fan_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist_id, fan_id)
);

-- 2. 建立 messages 資料表 (聊天訊息)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('artist', 'fan')),
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'music', 'system')),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 擴展 game_sessions 資料表
ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS chat_triggered BOOLEAN DEFAULT FALSE;

-- 4. 建立索引
CREATE INDEX IF NOT EXISTS idx_conversations_artist_id ON conversations(artist_id);
CREATE INDEX IF NOT EXISTS idx_conversations_fan_id ON conversations(fan_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_game_sessions_is_completed ON game_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_game_sessions_chat_triggered ON game_sessions(chat_triggered);

-- 5. 插入系統預設藝人賬戶 (怪奇)
INSERT INTO users (id, email, password_hash, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'guaiqi@system.local',
    '$2b$10$placeholder.hash.for.system.account',
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;