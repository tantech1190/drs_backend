/**
 * Check Admin User Script
 * 
 * This script checks if the admin user exists and displays its details
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  userType: String,
  isAdmin: Boolean,
  isActive: Boolean,
  isOnboarded: Boolean,
  emailVerified: Boolean,
  phoneVerified: Boolean,
  firstName: String,
  lastName: String
}, { timestamps: true });

// Add comparePassword method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

async function checkAdmin() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/drsclub';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    console.log('🔍 Searching for admin user...\n');
    
    const admin = await User.findOne({ username: 'admin' });
    
    if (!admin) {
      console.log('❌ Admin user NOT FOUND!');
      console.log('\n💡 Create admin user by running:');
      console.log('   node scripts/createAdmin.js\n');
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log('✅ Admin user found!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Admin User Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Username:       ${admin.username}`);
    console.log(`   Email:          ${admin.email}`);
    console.log(`   User Type:      ${admin.userType}`);
    console.log(`   Is Admin:       ${admin.isAdmin}`);
    console.log(`   Is Active:      ${admin.isActive}`);
    console.log(`   Is Onboarded:   ${admin.isOnboarded}`);
    console.log(`   Email Verified: ${admin.emailVerified}`);
    console.log(`   Phone Verified: ${admin.phoneVerified}`);
    console.log(`   First Name:     ${admin.firstName || 'N/A'}`);
    console.log(`   Last Name:      ${admin.lastName || 'N/A'}`);
    console.log(`   Created:        ${admin.createdAt}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test password
    console.log('🔐 Testing password "Admin@123"...');
    const isPasswordValid = await admin.comparePassword('Admin@123');
    
    if (isPasswordValid) {
      console.log('✅ Password is CORRECT!\n');
    } else {
      console.log('❌ Password does NOT match!\n');
      console.log('⚠️  This means the password hash is incorrect.');
      console.log('💡 Solution: Delete and recreate admin user:\n');
      console.log('   db.users.deleteOne({ username: "admin" })');
      console.log('   node scripts/createAdmin.js\n');
    }

    // Check for issues
    console.log('🔍 Checking for potential issues...\n');
    
    const issues = [];
    
    if (!admin.isAdmin) {
      issues.push('❌ isAdmin is false - user is not marked as admin');
    }
    
    if (!admin.isActive) {
      issues.push('❌ isActive is false - account is deactivated');
    }
    
    if (admin.userType !== 'admin') {
      issues.push(`⚠️  userType is "${admin.userType}" (expected "admin")`);
    }
    
    if (!admin.password || admin.password.length < 20) {
      issues.push('❌ Password appears to be unhashed or invalid');
    }
    
    if (issues.length > 0) {
      console.log('⚠️  ISSUES FOUND:');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('\n💡 Fix with:');
      console.log('   db.users.deleteOne({ username: "admin" })');
      console.log('   node scripts/createAdmin.js\n');
    } else {
      console.log('✅ No issues found! Admin user looks good.\n');
      console.log('🚀 You should be able to login with:');
      console.log('   Username: admin');
      console.log('   Password: Admin@123\n');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('\n🔧 Drs Club - Admin User Check Script');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

checkAdmin().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
