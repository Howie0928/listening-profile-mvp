async function testAuthFlow() {
  const baseUrl = 'http://localhost:3000';
  const timestamp = Date.now();
  const testEmail = `testuser${timestamp}@test.com`;
  const testPassword = 'test123456';

  console.log('Testing authentication flow...');
  console.log(`Email: ${testEmail}`);
  console.log('---');

  try {
    // Step 1: Register
    console.log('1. Testing registration...');
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    const registerData = await registerResponse.json();
    console.log('Registration response:', JSON.stringify(registerData, null, 2));

    if (!registerData.success || !registerData.token) {
      console.error('Registration failed or no token received');
      return;
    }

    const token = registerData.token;
    console.log('\nReceived token:', token);
    console.log('---');

    // Step 2: Test /api/users/me with the token
    console.log('\n2. Testing /api/users/me with token...');
    const meResponse = await fetch(`${baseUrl}/api/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Status code:', meResponse.status);
    const meData = await meResponse.json();
    console.log('/api/users/me response:', JSON.stringify(meData, null, 2));

    if (meResponse.status === 200) {
      console.log('\n✅ Authentication flow working correctly!');
    } else {
      console.log('\n❌ Authentication failed with status:', meResponse.status);

      // Debug: decode JWT token locally
      console.log('\n3. Debugging JWT token...');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        console.log('Token payload:', JSON.stringify(payload, null, 2));
      }
    }

  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testAuthFlow();