# 藝人管理 API 文件

## API 端點

### 1. 獲取藝人的粉絲列表
**端點:** `GET /api/artist/fans`

**認證:** 需要藝人賬戶的 JWT token

**響應格式:**
```json
{
  "success": true,
  "message": "Fans list retrieved successfully",
  "fans": [
    {
      "id": "user-uuid",
      "nickname": "粉絲暱稱",
      "joinDate": "2024-01-20",
      "hasConversation": true,
      "lastMessage": "最後訊息內容",
      "unreadCount": 2
    }
  ]
}
```

**功能說明:**
- 返回所有與藝人有對話記錄或完成遊戲的粉絲
- 顯示未讀訊息數量
- 按最後互動時間排序

### 2. 藝人主動開啟對話
**端點:** `POST /api/artist/chat/init`

**認證:** 需要藝人賬戶的 JWT token

**請求格式:**
```json
{
  "fanId": "fan-user-uuid"
}
```

**響應格式:**
```json
{
  "success": true,
  "message": "Conversation created successfully",
  "conversation": {
    "id": "conversation-uuid",
    "artistId": "artist-uuid",
    "fanId": "fan-uuid",
    "createdAt": "2024-01-20T10:30:00Z"
  }
}
```

**功能說明:**
- 創建新對話或返回現有對話
- 自動發送歡迎訊息
- 驗證粉絲存在性

## 安全措施

1. **身份驗證:** 所有端點都需要有效的 JWT token
2. **權限控制:** 只有藝人賬戶（ID: 00000000-0000-0000-0000-000000000001）可以訪問這些端點
3. **CORS 支持:** 已配置跨域請求支持

## 測試狀態

✅ 兩個 API 端點已成功創建並通過以下測試：
- 無認證訪問正確返回 401 Unauthorized
- API 路由正確編譯和響應
- 伺服器運行在 port 3002

## 下一步

前端團隊可以使用這些 API 來實現：
1. 藝人粉絲列表界面
2. 藝人主動發起對話功能
3. 未讀訊息標記顯示