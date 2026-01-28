/**
 * Fix Admin User Script
 * 
 * This script deletes and recreates the admin user with the correct schema
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAdmin() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/drsclub';
    console.log('🔌 Connecting to MongoDB...');
    console.log('   URI:', mongoURI.replace(/:[^:@]+@/, ':****@')); // Hide password
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Use the raw collection to avoid model validation issues
    const usersCollection = mongoose.connection.collection('users');

    // Check if admin exists
    console.log('🔍 Checking for existing admin user...');
    const existingAdmin = await usersCollection.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('⚠️  Found existing admin user');
      console.log('   Username:', existingAdmin.username);
      console.log('   UserType:', existingAdmin.userType);
      console.log('   IsAdmin:', existingAdmin.isAdmin);
      console.log('\n🗑️  Deleting old admin user...');
      
      await usersCollection.deleteOne({ username: 'admin' });
      console.log('✅ Deleted old admin user\n');
    } else {
      console.log('ℹ️  No existing admin user found\n');
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);
    console.log('✅ Password hashed\n');

    // Create new admin with correct schema
    console.log('👤 Creating new admin user...');
    const newAdmin = {
      username: 'admin',
      email: 'admin@drsclub.com',
      password: hashedPassword,
      userType: 'admin',  // ← This is the critical field
      isAdmin: true,       // ← THIS TOO!
      isActive: true,
      isOnboarded: true,
      emailVerified: true,
      phoneVerified: true,
      firstName: 'Super',
      lastName: 'Admin',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await usersCollection.insertOne(newAdmin);
    console.log('✅ Admin user created successfully!\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 ADMIN USER CREATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Username:  admin');
    console.log('   Password:  Admin@123');
    console.log('   UserType:  admin');
    console.log('   IsAdmin:   true');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Verify it was created correctly
    console.log('✅ Verifying admin user...');
    const verifyAdmin = await usersCollection.findOne({ username: 'admin' });
    
    if (verifyAdmin && verifyAdmin.userType === 'admin' && verifyAdmin.isAdmin === true) {
      console.log('✅ Verification successful!\n');
      console.log('🚀 Next steps:');
      console.log('   1. Restart your backend server');
      console.log('   2. Login with username: admin, password: Admin@123\n');
    } else {
      console.log('❌ Verification failed!');
      console.log('   Created user:', verifyAdmin);
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

console.log('\n🔧 Drs Club - Fix Admin User Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

fixAdmin().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});