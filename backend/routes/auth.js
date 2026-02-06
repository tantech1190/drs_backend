const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { uploadImage, uploadDocument, uploadOnboarding } = require('../middleware/upload');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your_secret_key', {
    expiresIn: '30d'
  });
};

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', [
  body('username').trim().isLength({ min: 3 }).toLowerCase(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('userType').isIn(['doctor', 'vendor', 'paramedical','attorneys'])
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password, userType } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this email or username already exists' 
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      userType,
      isOnboarded: false
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        isOnboarded: user.isOnboarded
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Server error during signup' });
  }
});

// @route   POST /api/auth/signin
// @desc    Sign in user
// @access  Public
router.post('/signin', [
  body('username').trim().notEmpty(),
  body('password').notEmpty(),
  body('userType').isIn(['doctor', 'vendor', 'paramedical', 'attorneys','admin'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, password, userType } = req.body;

    // Find user - for admin, check both userType and isAdmin flag
    let user;
    if (userType === 'admin') {
      user = await User.findOne({ 
        username: username.toLowerCase(),
        $or: [
          { userType: 'admin' },
          { isAdmin: true }
        ]
      });
    } else {
      user = await User.findOne({ username: username.toLowerCase(), userType });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login - use updateOne to bypass validation
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Signed in successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        isAdmin: user.isAdmin,
        isOnboarded: user.isOnboarded,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        profilePicture: user.profilePicture,
        companyLogo: user.companyLogo
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      username: req.body?.username,
      userType: req.body?.userType
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server error during signin',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (alias for signin, accepts email or username)
// @access  Public
router.post('/login', [
  body('email').trim().notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, type } = req.body;

    // Find user by email or username
    let user;
    if (type === 'admin') {
      user = await User.findOne({ 
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() }
        ],
        $and: [
          {
            $or: [
              { userType: 'admin' },
              { isAdmin: true }
            ]
          }
        ]
      });
    } else {
      const query = {
        $or: [
          { email: email.toLowerCase() },
          { username: email.toLowerCase() }
        ]
      };
      
      // If type is provided, also filter by userType
      if (type) {
        query.userType = type;
      }
      
      user = await User.findOne(query);
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login - use updateOne to bypass validation
    await User.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        isAdmin: user.isAdmin,
        isOnboarded: user.isOnboarded,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        profilePicture: user.profilePicture,
        companyLogo: user.companyLogo
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// @route   POST /api/auth/onboarding/doctor
// @desc    Complete doctor onboarding
// @access  Private
router.post('/onboarding/doctor', auth, uploadOnboarding.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'medicalLicense', maxCount: 1 },
  { name: 'degreeCertificate', maxCount: 1 },
  { name: 'boardCertification', maxCount: 1 }
]), async (req, res) => {
  try {
    if (req.user.userType !== 'doctor') {
      return res.status(403).json({ success: false, message: 'Only doctors can access this endpoint' });
    }

    const {
      firstName,
      lastName,
      specialty,
      subSpecialty,
      location,
      city,
      state,
      zip,
      phone,
      bio
    } = req.body;

    // Update user profile
    req.user.firstName = firstName;
    req.user.lastName = lastName;
    req.user.specialty = specialty;
    req.user.subSpecialty = subSpecialty;
    req.user.location = location;
    req.user.city = city;
    req.user.state = state;
    req.user.zip = zip;
    req.user.phone = phone;
    req.user.bio = bio;
    req.user.isOnboarded = true;

    // Handle file uploads
    if (req.files?.profilePicture) {
      req.user.profilePicture = '/uploads/images/' + req.files.profilePicture[0].filename;
    }

    await req.user.save();

    // Save documents
    const Document = require('../models/Document');
    const documents = [];

    if (req.files?.medicalLicense) {
      const doc = new Document({
        user: req.user._id,
        title: 'Medical License',
        type: 'medical-license',
        fileName: req.files.medicalLicense[0].originalname,
        filePath: '/uploads/documents/' + req.files.medicalLicense[0].filename,
        fileSize: req.files.medicalLicense[0].size,
        mimeType: req.files.medicalLicense[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    if (req.files?.degreeCertificate) {
      const doc = new Document({
        user: req.user._id,
        title: 'Degree Certificate',
        type: 'degree',
        fileName: req.files.degreeCertificate[0].originalname,
        filePath: '/uploads/documents/' + req.files.degreeCertificate[0].filename,
        fileSize: req.files.degreeCertificate[0].size,
        mimeType: req.files.degreeCertificate[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    if (req.files?.boardCertification) {
      const doc = new Document({
        user: req.user._id,
        title: 'Board Certification',
        type: 'board-certification',
        fileName: req.files.boardCertification[0].originalname,
        filePath: '/uploads/documents/' + req.files.boardCertification[0].filename,
        fileSize: req.files.boardCertification[0].size,
        mimeType: req.files.boardCertification[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    res.json({
      success: true,
      message: 'Doctor onboarding completed successfully',
      user: req.user.getFullProfile(),
      documents
    });
  } catch (error) {
    console.error('Doctor onboarding error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error during onboarding',
      error: error.message 
    });
  }
});

// @route   POST /api/auth/onboarding/vendor
// @desc    Complete vendor onboarding
// @access  Private
router.post('/onboarding/vendor', auth, uploadOnboarding.fields([
  { name: 'companyLogo', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 }
]), async (req, res) => {
  try {
    if (req.user.userType !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Only vendors can access this endpoint' });
    }

    const {
      companyName,
      contactPerson,
      phone,
      website,
      category,
      address,
      city,
      state,
      zip,
      description,
      servicesOffered
    } = req.body;

    // Update user profile
    req.user.companyName = companyName;
    req.user.contactPerson = contactPerson;
    req.user.phone = phone;
    req.user.website = website;
    req.user.category = category;
    req.user.address = address;
    req.user.city = city;
    req.user.state = state;
    req.user.zip = zip;
    req.user.description = description;
    req.user.servicesOffered = servicesOffered;
    req.user.isOnboarded = true;

    // Handle file uploads
    if (req.files?.companyLogo) {
      req.user.companyLogo = '/uploads/images/' + req.files.companyLogo[0].filename;
    }

    if (req.files?.businessLicense) {
      req.user.businessLicense = '/uploads/documents/' + req.files.businessLicense[0].filename;
    }

    await req.user.save();

    res.json({
      success: true,
      message: 'Vendor onboarding completed successfully',
      user: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Vendor onboarding error:', error);
    res.status(500).json({ success: false, message: 'Error during onboarding' });
  }
});

// @route   POST /api/auth/onboarding/attorneys
// @desc    Complete attorney onboarding
// @access  Private
router.post('/onboarding/attorneys', auth, uploadOnboarding.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'collegeDegree', maxCount: 1 },
  { name: 'stateLicense', maxCount: 1 }
]), async (req, res) => {
  try {
    if (req.user.userType !== 'attorneys') {
      return res.status(403).json({ success: false, message: 'Only attorneys can access this endpoint' });
    }

    const {
      firstName,
      lastName,
      firmName,
      specialty,
      licenseNumber,
      location,
      city,
      state,
      zip,
      phone,
      website,
      bio
    } = req.body;

    // Update user profile
    req.user.firstName = firstName;
    req.user.lastName = lastName;
    req.user.companyName = firmName; // Using companyName field for law firm
    req.user.specialty = specialty; // e.g., "Medical Malpractice", "Healthcare Law", etc.
    req.user.location = location;
    req.user.city = city;
    req.user.state = state;
    req.user.zip = zip;
    req.user.phone = phone;
    req.user.website = website;
    req.user.bio = bio;
    req.user.isOnboarded = true;

    // Handle file uploads
    if (req.files?.profilePicture) {
      req.user.profilePicture = '/uploads/images/' + req.files.profilePicture[0].filename;
    }

    await req.user.save();

    // Save documents
    const Document = require('../models/Document');
    const documents = [];

    if (req.files?.collegeDegree) {
      const doc = new Document({
        user: req.user._id,
        title: 'College Degree',
        type: 'college-degree',
        fileName: req.files.collegeDegree[0].originalname,
        filePath: '/uploads/documents/' + req.files.collegeDegree[0].filename,
        fileSize: req.files.collegeDegree[0].size,
        mimeType: req.files.collegeDegree[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    if (req.files?.stateLicense) {
      const doc = new Document({
        user: req.user._id,
        title: 'State License',
        type: 'state-license',
        fileName: req.files.stateLicense[0].originalname,
        filePath: '/uploads/documents/' + req.files.stateLicense[0].filename,
        fileSize: req.files.stateLicense[0].size,
        mimeType: req.files.stateLicense[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    res.json({
      success: true,
      message: 'Attorney onboarding completed successfully',
      user: req.user.getFullProfile(),
      documents
    });
  } catch (error) {
    console.error('Attorney onboarding error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error during onboarding',
      error: error.message 
    });
  }
});

// @route   POST /api/auth/onboarding/paramedical
// @desc    Complete paramedical staff onboarding
// @access  Private
router.post('/onboarding/paramedical', auth, uploadOnboarding.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'professionalLicense', maxCount: 1 },
  { name: 'certification', maxCount: 1 }
]), async (req, res) => {
  try {
    if (req.user.userType !== 'paramedical') {
      return res.status(403).json({ success: false, message: 'Only paramedical staff can access this endpoint' });
    }

    const {
      firstName,
      lastName,
      specialty,
      subSpecialty,
      location,
      city,
      state,
      zip,
      phone,
      bio
    } = req.body;

    // Update user profile (similar to doctor but for paramedical staff)
    req.user.firstName = firstName;
    req.user.lastName = lastName;
    req.user.specialty = specialty; // e.g., "Nurse", "Dietitian", "Physiotherapist"
    req.user.subSpecialty = subSpecialty;
    req.user.location = location;
    req.user.city = city;
    req.user.state = state;
    req.user.zip = zip;
    req.user.phone = phone;
    req.user.bio = bio;
    req.user.isOnboarded = true;

    // Handle file uploads
    if (req.files?.profilePicture) {
      req.user.profilePicture = '/uploads/images/' + req.files.profilePicture[0].filename;
    }

    await req.user.save();

    // Save documents
    const Document = require('../models/Document');
    const documents = [];

    if (req.files?.professionalLicense) {
      const doc = new Document({
        user: req.user._id,
        title: 'Professional License',
        type: 'professional-license',
        fileName: req.files.professionalLicense[0].originalname,
        filePath: '/uploads/documents/' + req.files.professionalLicense[0].filename,
        fileSize: req.files.professionalLicense[0].size,
        mimeType: req.files.professionalLicense[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    if (req.files?.certification) {
      const doc = new Document({
        user: req.user._id,
        title: 'Professional Certification',
        type: 'certification',
        fileName: req.files.certification[0].originalname,
        filePath: '/uploads/documents/' + req.files.certification[0].filename,
        fileSize: req.files.certification[0].size,
        mimeType: req.files.certification[0].mimetype
      });
      await doc.save();
      documents.push(doc);
    }

    res.json({
      success: true,
      message: 'ParaMedical onboarding completed successfully',
      user: req.user.getFullProfile(),
      documents
    });
  } catch (error) {
    console.error('ParaMedical onboarding error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Error during onboarding',
      error: error.message 
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user.getFullProfile()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user data' });
  }
});

module.exports = router;