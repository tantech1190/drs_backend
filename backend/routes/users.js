const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// @route   GET /api/users/search
// @desc    Search for users (doctors or vendors)
// @access  Private
router.get('/search', auth, async (req, res) => {
  try {
    const { type, specialty, category, location, search } = req.query;
    
    let query = { isActive: true, isOnboarded: true, _id: { $ne: req.userId } };

    // Filter by user type
    if (type) {
      query.userType = type;
    }

    // Filter by specialty (for doctors)
    if (specialty) {
      query.specialty = { $regex: specialty, $options: 'i' };
    }

    // Filter by category (for vendors)
    if (category) {
      query.category = category;
    }

    // Filter by location
    if (location) {
      query.$or = [
        { city: { $regex: location, $options: 'i' } },
        { state: { $regex: location, $options: 'i' } }
      ];
    }

    // Search by name or company
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .limit(50);

    // Check if users are connected and fetch documents for doctors
    const usersWithConnectionStatus = await Promise.all(users.map(async (user) => {
      const isConnected = req.user.connections.some(
        conn => conn.toString() === user._id.toString()
      );
      
      const profile = isConnected ? user.getFullProfile() : user.getPublicProfile();
      
      // Fetch documents for doctors to determine verification status
      let documents = [];
      if (user.userType === 'doctor') {
        documents = await Document.find({ user: user._id }).select('type isVerified');
      }
      
      return {
        ...profile,
        isConnected,
        documents: documents.map(doc => ({
          documentType: doc.type === 'medical-license' ? 'license' 
            : doc.type === 'board-certification' ? 'certification' 
            : doc.type,
          verified: doc.isVerified
        }))
      };
    }));

    res.json({
      success: true,
      users: usersWithConnectionStatus
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ success: false, message: 'Error searching users' });
  }
});

// @route   GET /api/users/featured-vendors
// @desc    Get featured vendors
// @access  Public
router.get('/featured-vendors', async (req, res) => {
  try {
    const featuredVendors = await User.find({
      userType: 'vendor',
      isFeatured: true,
      featuredUntil: { $gte: new Date() },
      isActive: true,
      'subscription.status': 'active'
    })
    .select('companyName category city state companyLogo description')
    .limit(10);

    res.json({
      success: true,
      vendors: featuredVendors
    });
  } catch (error) {
    console.error('Get featured vendors error:', error);
    res.status(500).json({ success: false, message: 'Error fetching featured vendors' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if connected
    const isConnected = req.user.connections.some(
      conn => conn.toString() === user._id.toString()
    );

    const profile = isConnected ? user.getFullProfile() : user.getPublicProfile();

    res.json({
      success: true,
      user: {
        ...profile,
        isConnected
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user profile' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile (with optional image upload)
// @access  Private
router.put('/profile', auth, uploadImage.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 }
]), async (req, res) => {
  try {
    const allowedUpdates = req.user.userType === 'doctor'
      ? ['firstName', 'lastName', 'specialty', 'subSpecialty', 'location', 'city', 'state', 'zip', 'phone', 'bio', 'jobStatus', 'showJobStatus', 'showPhone', 'showEmail', 'showLocation', 'showBio']
      : ['companyName', 'contactPerson', 'phone', 'website', 'category', 'address', 'city', 'state', 'zip', 'description', 'servicesOffered'];

    const updates = Object.keys(req.body);
    const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      return res.status(400).json({ success: false, message: 'Invalid updates' });
    }

    // Update regular fields
    updates.forEach(update => {
      req.user[update] = req.body[update];
    });

    // Handle profile picture upload (for doctors)
    if (req.files && req.files.profilePicture) {
      // Delete old profile picture if it exists
      if (req.user.profilePicture) {
        const oldImagePath = path.join(__dirname, '..', req.user.profilePicture);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('🗑️ Deleted old profile picture:', req.user.profilePicture);
          } catch (err) {
            console.error('Error deleting old profile picture:', err);
          }
        }
      }

      const imagePath = `/uploads/images/${req.files.profilePicture[0].filename}`;
      req.user.profilePicture = imagePath;
      console.log('✅ Profile picture uploaded:', imagePath);
    }

    // Handle company logo upload (for vendors)
    if (req.files && req.files.companyLogo) {
      // Delete old company logo if it exists
      if (req.user.companyLogo) {
        const oldImagePath = path.join(__dirname, '..', req.user.companyLogo);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('🗑️ Deleted old company logo:', req.user.companyLogo);
          } catch (err) {
            console.error('Error deleting old company logo:', err);
          }
        }
      }

      const imagePath = `/uploads/images/${req.files.companyLogo[0].filename}`;
      req.user.companyLogo = imagePath;
      console.log('✅ Company logo uploaded:', imagePath);
    }

    await req.user.save();

    const imageUploaded = (req.files && (req.files.profilePicture || req.files.companyLogo));

    res.json({
      success: true,
      message: imageUploaded ? 'Profile and image updated successfully' : 'Profile updated successfully',
      user: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Error updating profile' });
  }
});

module.exports = router;