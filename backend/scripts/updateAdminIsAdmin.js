/**
 * Update existing admin user to add isAdmin: true flag
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function updateAdmin() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drsclub';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected\n');

    const usersCollection = mongoose.connection.collection('users');

    console.log('🔍 Finding admin user...');
    const admin = await usersCollection.findOne({ username: 'admin' });

    if (!admin) {
      console.log('❌ No admin user found!');
      console.log('💡 Run: node scripts/fixAdmin.js to create one');
      process.exit(1);
    }

    console.log('📋 Current admin status:');
    console.log('   Username:', admin.username);
    console.log('   UserType:', admin.userType);
    console.log('   isAdmin:', admin.isAdmin);
    console.log('');

    console.log('🔧 Updating admin user...');
    const result = await usersCollection.updateOne(
      { username: 'admin' },
      { 
        $set: { 
          isAdmin: true,
          userType: 'admin',
          isActive: true,
          isOnboarded: true
        } 
      }
    );

    console.log('✅ Updated!');
    console.log('   Modified count:', result.modifiedCount);
    console.log('');

    // Verify
    const updated = await usersCollection.findOne({ username: 'admin' });
    console.log('✅ Verified new status:');
    console.log('   Username:', updated.username);
    console.log('   UserType:', updated.userType);
    console.log('   isAdmin:', updated.isAdmin);
    console.log('   isActive:', updated.isActive);
    console.log('   isOnboarded:', updated.isOnboarded);

    await mongoose.connection.close();
    console.log('\n✅ Done! Please restart your backend server.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('\n🔧 Update Admin isAdmin Flag\n');
updateAdmin();
