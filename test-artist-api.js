const axios = require('axios');

const API_URL = 'http://localhost:3002/api';
const ARTIST_TOKEN = process.env.ARTIST_TOKEN || ''; // You'll need to provide a valid artist JWT token

async function testArtistAPIs() {
  console.log('Testing Artist Management APIs...\n');

  // Test 1: Get fans list
  console.log('1. Testing GET /api/artist/fans');
  try {
    const response = await axios.get(`${API_URL}/artist/fans`, {
      headers: {
        'Authorization': `Bearer ${ARTIST_TOKEN}`
      }
    });
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n2. Testing POST /api/artist/chat/init');
  try {
    const response = await axios.post(`${API_URL}/artist/chat/init`,
      {
        fanId: 'test-fan-id' // Replace with actual fan ID
      },
      {
        headers: {
          'Authorization': `Bearer ${ARTIST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
  }

  console.log('\n3. Testing without authentication');
  try {
    const response = await axios.get(`${API_URL}/artist/fans`);
    console.log('❌ Should have failed but got:', response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ Correctly returned 401 Unauthorized');
    } else {
      console.log('❌ Unexpected error:', error.response?.data || error.message);
    }
  }
}

// Check if token is provided
if (!ARTIST_TOKEN) {
  console.log(`
⚠️  WARNING: No artist token provided!
To test the APIs properly, you need to provide a valid JWT token for the artist account.

You can obtain a token by:
1. Login as the artist account (ID: 00000000-0000-0000-0000-000000000001)
2. Copy the JWT token from the authentication response
3. Run: ARTIST_TOKEN="your_token_here" node test-artist-api.js

For now, testing without authentication...
  `);
}

testArtistAPIs().catch(console.error);