# 聽覺的東西 - 網站/社群平台專案記憶

## 專案資訊
- **專案名稱：** Audible Thing Community Platform
- **技術棧：** Next.js, React
- **目標：** Spotify 資料分析、社群互動、AI 音樂整合
- **專案路徑：** C:\Users\user\聽覺的東西網站前後端開發\網頁後端架構
- **上線時間：** 預計 2026 年 1 月

## 技術架構

### 前端
- **框架：** Next.js（React）
- **樣式：** CSS Modules (styles/)
- **UI 組件：** 待確認

### 後端
- **資料庫：** database/ 目錄
- **API：** Next.js API Routes (pages/api/)
- **環境變數：** .env.local

### 整合服務
- **Spotify API：** OAuth 認證、聽歌記錄、音樂分析
- **遊戲後端：** WebSocket 連接遊戲專案
- **AI 服務：** 音樂生成、推薦系統

## 開發規範

### 程式碼風格
- JavaScript/TypeScript：2 空格縮進
- 命名：camelCase（變數、函數），PascalCase（組件）
- 檔案命名：kebab-case.js 或 PascalCase.jsx（組件）

### 目錄結構
```
pages/          - Next.js 頁面與 API 路由
  api/          - API 端點
  index.js      - 首頁
lib/            - 工具函數與共用邏輯
public/         - 靜態資源
styles/         - 全域樣式
database/       - 資料庫 Schema 與遷移
```

### API 設計
- RESTful 原則
- 路徑：`/api/v1/{resource}/{action}`
- 回應格式：JSON
- 錯誤處理：統一錯誤碼

## 與遊戲專案的整合

### 資料流
```
Spotify → 網站分析 → 使用者檔案 → 遊戲載入
                       ↓
遊戲進度/成就 → 網站顯示 → 社群分享
```

### 共享資料結構
參考：@C:\Users\user\AudibleThing-Shared-Docs\SHARED-MEMORY.md

### 整合端點
- **使用者同步：** `/api/v1/user/sync`
- **遊戲進度：** `/api/v1/game/progress`
- **音樂資料：** `/api/v1/spotify/profile`

## Spotify 整合

### OAuth 流程
1. 使用者授權 Spotify
2. 取得 Access Token
3. 定期更新聽歌記錄
4. 分析音樂偏好

### 資料分析
- Top Artists / Tracks / Genres
- Audio Features (能量、舞曲性、情緒)
- 聽歌習慣時段分析
- 個人化推薦

## 遊戲化功能

### 與 Unity 遊戲連動
- 音樂檔案轉為遊戲關卡
- 聽歌成就同步到遊戲
- 遊戲進度顯示在個人頁面
- 社群分享遊戲成績

### 粉絲互動
- 留言討論
- 音樂推薦
- 排行榜
- 活動參與

## 環境設定

### 開發環境
```bash
npm install
npm run dev       # 啟動開發伺服器 (localhost:3000)
```

### 環境變數 (.env.local)
```
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
DATABASE_URL=
NEXT_PUBLIC_API_URL=
GAME_WEBSOCKET_URL=
```

## 部署

### 平台選項
- Vercel（推薦，Next.js 原生支援）
- Cloudflare Pages
- 自架伺服器

### 部署命令
```bash
npm run build
npm run start
```

## 重要提醒

- 保護 Spotify API 密鑰，不要提交到版本控制
- 定期備份資料庫
- 測試與遊戲專案的 API 整合
- 注意 CORS 設定（跨域請求）
- 使用者隱私資料要加密存儲

## 待辦事項

- [ ] 完成 Spotify OAuth 整合
- [ ] 建立使用者資料庫 Schema
- [ ] 實作與遊戲的 WebSocket 連接
- [ ] 設計社群互動功能
- [ ] 音樂資料視覺化
- [ ] 部署到測試環境
