const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }

    // Attach user to request
    req.user = user;
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ success: false, message: 'Token is not valid' });
  }
};

// Check if user is a doctor
const isDoctor = (req, res, next) => {
  if (req.user.userType !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Access denied. Doctors only.' });
  }
  next();
};

// Check if user is a vendor
const isVendor = (req, res, next) => {
  if (req.user.userType !== 'vendor') {
    return res.status(403).json({ success: false, message: 'Access denied. Vendors only.' });
  }
  next();
};

// Check if vendor has active subscription
const hasActiveSubscription = (req, res, next) => {
  if (req.user.userType === 'vendor' && req.user.subscription.status !== 'active') {
    return res.status(403).json({ 
      success: false, 
      message: 'Active subscription required. Please renew your subscription.' 
    });
  }
  next();
};

module.exports = { auth, isDoctor, isVendor, hasActiveSubscription };
