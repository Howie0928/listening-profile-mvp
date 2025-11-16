const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

const payload = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: 'qzzy@artist.com',
  role: 'artist',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
};

const token = jwt.sign(payload, process.env.JWT_SECRET);
console.log('🔑 怪奇 (藝人) Token:');
console.log(token);

// 測試API
const testAPI = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/artist/messages', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    console.log('\n📬 藝人訊息API 結果:');
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('API測試失敗:', error.message);
  }
};

testAPI();