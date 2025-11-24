# 社交雷達與社群系統 API 文件 (v1.1)

本文件描述了為支援社交雷達、配對與資產系統所新增的後端 API。

## 1. 社交雷達 (Social Radar)

### GET `/api/social/radar`
取得附近的用戶狀態。
- **Auth**: Required
- **Query Params**:
  - `lat`: 緯度 (Optional, if provided enables distance filtering)
  - `lng`: 經度 (Optional)
- **Response**:
  ```json
  {
    "users": [
      {
        "id": "status_uuid",
        "userId": "user_uuid",
        "status": "看大象體操缺1",
        "category": "ticket",
        "location": { "lat": 25.03, "lng": 121.56 },
        "name": "User123",
        "avatar": "url..."
      }
    ],
    "message": "Ghost mode enabled..." // if ghost mode is on
  }
  ```

### POST `/api/social/status`
發布新的即時狀態。
- **Auth**: Required
- **Body**:
  ```json
  {
    "status_text": "在北流喝一杯",
    "category": "party", // 'ticket', 'party', 'jam', 'idle', 'game_lobby'
    "lat": 25.03,
    "lng": 121.56
  }
  ```

### POST `/api/social/match-request`
對某個狀態發送配對請求。
- **Auth**: Required
- **Body**:
  ```json
  {
    "target_status_id": "status_uuid"
  }
  ```
- **Logic**: 
  - 檢查 24 小時內是否重複請求。
  - 建立 `pending` 狀態的對話。
  - 發送通知給對方。

## 2. 訊息中心 (Messaging)

### GET `/api/chat/inbox`
取得對話列表，分為主要訊息與陌生請求。
- **Auth**: Required
- **Response**:
  ```json
  {
    "primary": [ ...conversations ], // 已接受 (Accepted)
    "general": [ ...conversations ]  // 請求中 (Pending)
  }
  ```

### POST `/api/chat/approve-match`
接受或拒絕配對請求。
- **Auth**: Required
- **Body**:
  ```json
  {
    "conversation_id": "conv_uuid",
    "action": "accept" // or "reject"
  }
  ```

## 3. 用戶資產與設定 (User & Assets)

### GET `/api/user/wallet`
取得用戶資產（點數、票券）。
- **Auth**: Required
- **Response**:
  ```json
  {
    "points": 100,
    "vouchers": [ { "type": "voucher", "metadata": { "qr": "..." } } ],
    "items": []
  }
  ```

### POST `/api/user/settings`
更新用戶偏好設定。
- **Auth**: Required
- **Body**:
  ```json
  {
    "search_radius_km": 50,
    "age_range_min": 18,
    "age_range_max": 35,
    "ghost_mode": false,
    "audio_match_enabled": true
  }
  ```

## 4. 探索與遊戲 (Discover)

### GET `/api/discover/feed`
取得首頁探索內容（Hero, Social, Recommended, Templates）。
- **Auth**: Required
- **Response**:
  ```json
  {
    "hero": [ { "id": "...", "title": "...", "image": "..." } ],
    "social": [ { "id": "...", "title": "...", "type": "lobby" } ], // 來自 user_statuses
    "recommended": [ ... ],
    "templates": [ ... ]
  }
  ```
