const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header OR query parameter (for download links)
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    // If no token in header, check query parameter
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token, access denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    
    console.log('🔑 Auth Debug - Token decoded:', { userId: decoded.userId });
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    console.log('👤 Auth Debug - User found:', user ? `Yes (${user.username})` : 'No');
    
    if (!user) {
      console.error('❌ Auth Error: User not found in database for ID:', decoded.userId);
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

// Optional auth - attach user if token exists but don't block if it doesn't
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token && req.query.token) {
      token = req.query.token;
    }

    // If no token, just continue without user
    if (!token) {
      return next();
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (user && user.isActive) {
      // Attach user to request if found and active
      req.user = user;
      req.userId = decoded.userId;
    }
    
    next();
  } catch (error) {
    // On error, just continue without user (optional auth)
    next();
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  
  if (!req.user.isAdmin && req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
  next();
};

module.exports = { auth, isDoctor, isVendor, hasActiveSubscription, optionalAuth, isAdmin };