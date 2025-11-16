-- 聆聽側寫 MVP 資料庫初始化腳本 - 先鋒版
-- Database initialization script for Listening Profile MVP - Pioneer Version

-- 建立 users 資料表
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    spotify_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立 character_selections 資料表 (角色選擇記錄)
-- Create character_selections table
CREATE TABLE IF NOT EXISTS character_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立 game_sessions 資料表 (遊戲結果記錄)
-- Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_selection_id UUID REFERENCES character_selections(id),
    score INTEGER NOT NULL DEFAULT 0,
    game_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引以提升查詢效能
-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_spotify_id ON users(spotify_id);
CREATE INDEX IF NOT EXISTS idx_character_selections_user_id ON character_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_character_selections_character_code ON character_selections(character_code);
CREATE INDEX IF NOT EXISTS idx_character_selections_created_at ON character_selections(created_at);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_character_selection_id ON game_sessions(character_selection_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);