/**
 * Create Admin User Script
 * 
 * This script creates an admin user in the database.
 * Run this script to create the first admin user for the admin panel.
 * 
 * Usage:
 *   node scripts/createAdmin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Schema (matching your User model)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: { type: String, enum: ['doctor', 'vendor', 'admin'], default: 'doctor' },
  isAdmin: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isOnboarded: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Admin user configuration
const adminUser = {
  username: 'admin',
  email: 'admin@drsclub.com',
  password: 'Admin@123', // CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!
  userType: 'admin',
  isAdmin: true,
  isActive: true,
  isOnboarded: true,
  emailVerified: true,
  phoneVerified: true,
  firstName: 'System',
  lastName: 'Administrator'
};

async function createAdmin() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
        throw new Error('❌ MONGO_URI is not defined in .env file');
     }
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      $or: [
        { username: adminUser.username },
        { email: adminUser.email }
      ]
    });

    if (existingAdmin) {
      console.log('\n⚠️  Admin user already exists:');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Is Admin: ${existingAdmin.isAdmin}`);
      
      // Update existing user to be admin if not already
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        existingAdmin.userType = 'admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log('\n✅ Updated existing user to admin status');
      }
      
      await mongoose.connection.close();
      return;
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    adminUser.password = await bcrypt.hash(adminUser.password, salt);

    // Create admin user
    console.log('👤 Creating admin user...');
    const newAdmin = new User(adminUser);
    await newAdmin.save();

    console.log('\n✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Username: ${adminUser.username}`);
    console.log(`   Email: ${adminUser.email}`);
    console.log(`   Password: Admin@123`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT SECURITY NOTES:');
    console.log('   1. Change this password immediately after first login!');
    console.log('   2. Store credentials securely');
    console.log('   3. Do not share these credentials');
    console.log('\n🚀 You can now login to the admin panel at:');
    console.log('   http://localhost:5174/login\n');

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error.message);
    if (error.code === 11000) {
      console.log('\n💡 Tip: Admin user might already exist. Try logging in with existing credentials.');
    }
    process.exit(1);
  }
}

// Run the script
console.log('\n🔧 Drs Club - Admin User Creation Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

createAdmin().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
