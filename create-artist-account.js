const bcrypt = require('bcryptjs');
const { db } = require('./lib/db');

async function createArtistAccount() {
  try {
    console.log('Creating artist account for 怪奇 (Qzzy)...\n');

    // Generate password hash for '123456'
    const password = '123456';
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('Password hash generated for "123456"');

    // First, add role and artist_name columns if they don't exist
    console.log('\n1. Adding role and artist_name columns to users table...');

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'fan' CHECK (role IN ('fan', 'artist'))
    `);

    await db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255)
    `);

    console.log('✅ Columns added/verified');

    // Check if the artist account already exists
    const existingCheck = await db.query(
      'SELECT id, email FROM users WHERE id = $1 OR email = $2',
      ['00000000-0000-0000-0000-000000000001', 'qzzy@artist.com']
    );

    if (existingCheck.rows.length > 0) {
      console.log('\n2. Artist account already exists, updating...');

      // Update existing account
      await db.query(`
        UPDATE users
        SET
          id = '00000000-0000-0000-0000-000000000001',
          email = 'qzzy@artist.com',
          password_hash = $1,
          role = 'artist',
          artist_name = '怪奇'
        WHERE id = '00000000-0000-0000-0000-000000000001'
           OR email = 'qzzy@artist.com'
      `, [passwordHash]);

      console.log('✅ Artist account updated');
    } else {
      console.log('\n2. Creating new artist account...');

      // Insert new artist account
      await db.query(`
        INSERT INTO users (
          id,
          email,
          password_hash,
          role,
          artist_name,
          created_at
        ) VALUES (
          '00000000-0000-0000-0000-000000000001',
          'qzzy@artist.com',
          $1,
          'artist',
          '怪奇',
          CURRENT_TIMESTAMP
        )
      `, [passwordHash]);

      console.log('✅ Artist account created');
    }

    // Verify the account
    const verifyResult = await db.query(
      'SELECT id, email, role, artist_name FROM users WHERE id = $1',
      ['00000000-0000-0000-0000-000000000001']
    );

    console.log('\n3. Verification:');
    console.log('Account details:', verifyResult.rows[0]);

    console.log('\n✅ Artist account setup complete!');
    console.log('-----------------------------------');
    console.log('Login credentials:');
    console.log('Email: qzzy@artist.com');
    console.log('Password: 123456');
    console.log('Role: artist');
    console.log('Artist Name: 怪奇');
    console.log('ID: 00000000-0000-0000-0000-000000000001');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating artist account:', error);
    process.exit(1);
  }
}

// Run the script
createArtistAccount();