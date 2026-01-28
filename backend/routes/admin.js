const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Document = require('../models/Document');
const Message = require('../models/Message');
const Connection = require('../models/Connection');
const Contact = require('../models/Contact');
const Wallet = require('../models/Wallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { auth, isAdmin } = require('../middleware/auth');

// Apply auth and isAdmin middleware to all admin routes
router.use(auth);
router.use(isAdmin);

// ==================== DASHBOARD STATS ====================

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Admin only
router.get('/stats', async (req, res) => {
  try {
    const [
      totalDoctors,
      totalVendors,
      activeDoctors,
      activeVendors,
      totalEvents,
      totalConnections,
      totalMessages,
      totalDocuments,
      pendingContacts,
      onboardedDoctors,
      onboardedVendors,
      featuredVendors,
      activeSubscriptions,
      totalRevenue
    ] = await Promise.all([
      User.countDocuments({ userType: 'doctor' }),
      User.countDocuments({ userType: 'vendor' }),
      User.countDocuments({ userType: 'doctor', isActive: true }),
      User.countDocuments({ userType: 'vendor', isActive: true }),
      Event.countDocuments(),
      Connection.countDocuments({ status: 'accepted' }),
      Message.countDocuments(),
      Document.countDocuments(),
      Contact.countDocuments({ status: 'new' }),
      User.countDocuments({ userType: 'doctor', isOnboarded: true }),
      User.countDocuments({ userType: 'vendor', isOnboarded: true }),
      User.countDocuments({ userType: 'vendor', isFeatured: true }),
      User.countDocuments({ userType: 'vendor', 'subscription.status': 'active' }),
      User.aggregate([
        { $match: { userType: 'vendor', 'subscription.status': 'active' } },
        { $group: { _id: null, total: { $sum: '$subscription.amount' } } }
      ])
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [newDoctorsThisMonth, newVendorsThisMonth, newEventsThisMonth] = await Promise.all([
      User.countDocuments({ userType: 'doctor', createdAt: { $gte: thirtyDaysAgo } }),
      User.countDocuments({ userType: 'vendor', createdAt: { $gte: thirtyDaysAgo } }),
      Event.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          totalDoctors,
          totalVendors,
          activeDoctors,
          activeVendors,
          onboardedDoctors,
          onboardedVendors,
          total: totalDoctors + totalVendors
        },
        activity: {
          totalEvents,
          totalConnections,
          totalMessages,
          totalDocuments
        },
        vendors: {
          featuredVendors,
          activeSubscriptions,
          totalRevenue: totalRevenue[0]?.total || 0
        },
        support: {
          pendingContacts
        },
        growth: {
          newDoctorsThisMonth,
          newVendorsThisMonth,
          newEventsThisMonth
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics'
    });
  }
});

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users with filtering and pagination
// @access  Admin only
router.get('/users', async (req, res) => {
  try {
    const { 
      userType, 
      isActive, 
      isOnboarded,
      search,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    if (userType && userType !== 'all') {
      query.userType = userType;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (isOnboarded !== undefined) {
      query.isOnboarded = isOnboarded === 'true';
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get user details by ID
// @access  Admin only
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('connections', 'username email userType firstName lastName companyName')
      .populate('pendingRequests', 'username email userType firstName lastName companyName');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get additional stats
    const [documentsCount, eventsCount, messagesCount] = await Promise.all([
      Document.countDocuments({ user: user._id }),
      Event.countDocuments({ organizer: user._id }),
      Message.countDocuments({ 
        $or: [{ sender: user._id }, { receiver: user._id }]
      })
    ]);

    res.json({
      success: true,
      user,
      stats: {
        documents: documentsCount,
        events: eventsCount,
        messages: messagesCount,
        connections: user.connections.length
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user'
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user details
// @access  Admin only
router.put('/users/:id', async (req, res) => {
  try {
    const updates = req.body;
    
    // Prevent updating password through this route
    delete updates.password;
    
    // Prevent users from making themselves non-admin
    if (req.params.id === req.user.id) {
      delete updates.isAdmin;
      delete updates.userType;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete)
// @access  Admin only
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deactivated successfully',
      user
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

// @route   POST /api/admin/users/:id/activate
// @desc    Activate user account
// @access  Admin only
router.post('/users/:id/activate', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User activated successfully',
      user
    });
  } catch (error) {
    console.error('Activate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user'
    });
  }
});

// @route   POST /api/admin/users/:id/verify
// @desc    Verify user email/phone
// @access  Admin only
router.post('/users/:id/verify', async (req, res) => {
  try {
    const { emailVerified, phoneVerified } = req.body;
    
    const updates = {};
    if (emailVerified !== undefined) updates.emailVerified = emailVerified;
    if (phoneVerified !== undefined) updates.phoneVerified = phoneVerified;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User verification updated',
      user
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update verification'
    });
  }
});

// @route   POST /api/admin/users/:id/featured
// @desc    Toggle vendor featured status
// @access  Admin only
router.post('/users/:id/featured', async (req, res) => {
  try {
    const { isFeatured, featuredUntil } = req.body;
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.userType !== 'vendor') {
      return res.status(400).json({
        success: false,
        message: 'Only vendors can be featured'
      });
    }

    user.isFeatured = isFeatured;
    if (featuredUntil) {
      user.featuredUntil = new Date(featuredUntil);
    }
    
    await user.save();

    res.json({
      success: true,
      message: `Vendor ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      user: user.toObject()
    });
  } catch (error) {
    console.error('Toggle featured error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured status'
    });
  }
});

// ==================== AWARD MANAGEMENT ====================

// @route   GET /api/admin/users/:id/awards
// @desc    Get all awards for a user
// @access  Admin only
router.get('/users/:id/awards', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('awards username email userType')
      .populate('awards.grantedBy', 'username email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      awards: user.awards || []
    });
  } catch (error) {
    console.error('Get awards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve awards'
    });
  }
});

// @route   POST /api/admin/users/:id/awards
// @desc    Grant an award to a user
// @access  Admin only
router.post('/users/:id/awards', async (req, res) => {
  try {
    const { awardType, notes } = req.body;

    // Validate award type
    const validAwards = ['star', 'trophy', 'crown', 'shield', 'zap'];
    if (!validAwards.includes(awardType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid award type'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has this award
    const hasAward = user.awards.some(a => a.awardType === awardType);
    if (hasAward) {
      return res.status(400).json({
        success: false,
        message: 'User already has this award'
      });
    }

    // Add the award
    user.awards.push({
      awardType,
      grantedBy: req.user.id,
      grantedAt: new Date(),
      notes: notes || ''
    });

    await user.save();

    res.json({
      success: true,
      message: 'Award granted successfully',
      award: user.awards[user.awards.length - 1]
    });
  } catch (error) {
    console.error('Grant award error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to grant award'
    });
  }
});

// @route   DELETE /api/admin/users/:id/awards/:awardType
// @desc    Revoke an award from a user
// @access  Admin only
router.delete('/users/:id/awards/:awardType', async (req, res) => {
  try {
    const { id, awardType } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find and remove the award
    const awardIndex = user.awards.findIndex(a => a.awardType === awardType);
    
    if (awardIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Award not found'
      });
    }

    user.awards.splice(awardIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: 'Award revoked successfully'
    });
  } catch (error) {
    console.error('Revoke award error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke award'
    });
  }
});

// ==================== TAX RECORD MANAGEMENT ====================

// @route   GET /api/admin/users/:id/tax-records
// @desc    Get all tax records for a user
// @access  Admin only
router.get('/users/:id/tax-records', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('taxRecords username email userType');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return empty array if no tax records exist
    if (!user.taxRecords || user.taxRecords.length === 0) {
      return res.json({
        success: true,
        taxRecords: []
      });
    }

    // Sort tax records by year and quarter (most recent first)
    const sortedRecords = user.taxRecords.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      const quarters = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
      return quarters[b.quarter] - quarters[a.quarter];
    });

    res.json({
      success: true,
      taxRecords: sortedRecords
    });
  } catch (error) {
    console.error('Get tax records error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tax records',
      error: error.message
    });
  }
});

// @route   POST /api/admin/users/:id/tax-records
// @desc    Create a new tax record for a user
// @access  Admin only
router.post('/users/:id/tax-records', async (req, res) => {
  try {
    const { year, quarter, amount, status, paidDate, dueDate, notes } = req.body;

    // Validation
    if (!year || !quarter || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Year, quarter, and amount are required'
      });
    }

    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
      return res.status(400).json({
        success: false,
        message: 'Quarter must be Q1, Q2, Q3, or Q4'
      });
    }

    if (!['paid', 'pending', 'overdue'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be paid, pending, or overdue'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if record already exists for this year and quarter
    const existingRecord = user.taxRecords.find(
      r => r.year === year && r.quarter === quarter
    );

    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: `Tax record for ${year} ${quarter} already exists`
      });
    }

    // Add the tax record
    const newRecord = {
      year,
      quarter,
      amount,
      status: status || 'pending',
      paidDate: paidDate ? new Date(paidDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || '',
      createdBy: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    user.taxRecords.push(newRecord);
    await user.save();

    res.json({
      success: true,
      message: 'Tax record created successfully',
      taxRecord: user.taxRecords[user.taxRecords.length - 1]
    });
  } catch (error) {
    console.error('Create tax record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tax record'
    });
  }
});

// @route   PUT /api/admin/users/:id/tax-records/:recordId
// @desc    Update a tax record
// @access  Admin only
router.put('/users/:id/tax-records/:recordId', async (req, res) => {
  try {
    const { year, quarter, amount, status, paidDate, dueDate, notes } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const record = user.taxRecords.id(req.params.recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Tax record not found'
      });
    }

    // Update fields
    if (year !== undefined) record.year = year;
    if (quarter !== undefined) {
      if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
        return res.status(400).json({
          success: false,
          message: 'Quarter must be Q1, Q2, Q3, or Q4'
        });
      }
      record.quarter = quarter;
    }
    if (amount !== undefined) record.amount = amount;
    if (status !== undefined) {
      if (!['paid', 'pending', 'overdue'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be paid, pending, or overdue'
        });
      }
      record.status = status;
      
      // If status is changed to 'paid' and no paidDate, set it to now
      if (status === 'paid' && !record.paidDate) {
        record.paidDate = new Date();
      }
    }
    if (paidDate !== undefined) record.paidDate = paidDate ? new Date(paidDate) : null;
    if (dueDate !== undefined) record.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) record.notes = notes;
    
    record.updatedAt = new Date();

    await user.save();

    res.json({
      success: true,
      message: 'Tax record updated successfully',
      taxRecord: record
    });
  } catch (error) {
    console.error('Update tax record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax record'
    });
  }
});

// @route   DELETE /api/admin/users/:id/tax-records/:recordId
// @desc    Delete a tax record
// @access  Admin only
router.delete('/users/:id/tax-records/:recordId', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const record = user.taxRecords.id(req.params.recordId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Tax record not found'
      });
    }

    record.remove();
    await user.save();

    res.json({
      success: true,
      message: 'Tax record deleted successfully'
    });
  } catch (error) {
    console.error('Delete tax record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tax record'
    });
  }
});

// ==================== EVENT MANAGEMENT ====================

// @route   GET /api/admin/events
// @desc    Get all events
// @access  Admin only
router.get('/events', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'date', sortOrder = 'desc' } = req.query;

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const events = await Event.find()
      .populate('organizer', 'username email userType firstName lastName companyName')
      .populate('attendees.user', 'username email firstName lastName')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Event.countDocuments();

    res.json({
      success: true,
      events,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve events',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/events/:id
// @desc    Delete event (admin override)
// @access  Admin only
router.delete('/events/:id', async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event'
    });
  }
});

// ==================== CONTACT MANAGEMENT ====================

// @route   GET /api/admin/contacts
// @desc    Get all contact submissions
// @access  Admin only
router.get('/contacts', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const contacts = await Contact.find(query)
      .populate('userId', 'username email userType firstName lastName companyName')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Contact.countDocuments(query);

    res.json({
      success: true,
      contacts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve contacts'
    });
  }
});

// @route   PUT /api/admin/contacts/:id
// @desc    Update contact status
// @access  Admin only
router.put('/contacts/:id', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['new', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('userId', 'username email userType');

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact status updated',
      contact
    });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update contact'
    });
  }
});

// @route   DELETE /api/admin/contacts/:id
// @desc    Delete contact submission
// @access  Admin only
router.delete('/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact'
    });
  }
});

// ==================== DOCUMENT MANAGEMENT ====================

// @route   GET /api/admin/documents
// @desc    Get all documents
// @access  Admin only
router.get('/documents', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const documents = await Document.find()
      .populate('user', 'username email userType firstName lastName companyName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Document.countDocuments();

    res.json({
      success: true,
      documents,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents'
    });
  }
});

// ==================== CONNECTION MANAGEMENT ====================

// @route   GET /api/admin/connections
// @desc    Get all connections
// @access  Admin only
router.get('/connections', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const connections = await Connection.find(query)
      .populate('requester', 'username email userType firstName lastName companyName')
      .populate('recipient', 'username email userType firstName lastName companyName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Connection.countDocuments(query);

    res.json({
      success: true,
      connections,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve connections'
    });
  }
});

// ==================== MESSAGE MANAGEMENT ====================

// @route   GET /api/admin/messages
// @desc    Get all messages (for moderation)
// @access  Admin only
router.get('/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const messages = await Message.find()
      .populate('sender', 'username email userType firstName lastName companyName')
      .populate('receiver', 'username email userType firstName lastName companyName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Message.countDocuments();

    res.json({
      success: true,
      messages,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve messages'
    });
  }
});

// ==================== SPECIALITY MANAGEMENT ====================

// @route   GET /api/admin/specialities
// @desc    Get all specialities with doctor count
// @access  Admin only
router.get('/specialities', async (req, res) => {
  try {
    const Speciality = require('../models/Speciality');
    
    // Aggregate to count doctors per speciality
    const specialities = await Speciality.aggregate([
      {
        $lookup: {
          from: 'users',
          let: { specialityName: '$name' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userType', 'doctor'] },
                    { $eq: ['$specialty', '$$specialityName'] }
                  ]
                }
              }
            }
          ],
          as: 'doctors'
        }
      },
      {
        $addFields: {
          doctorCount: { $size: '$doctors' }
        }
      },
      {
        $project: {
          doctors: 0
        }
      },
      {
        $sort: { name: 1 }
      }
    ]);
    
    res.json({
      success: true,
      count: specialities.length,
      specialities
    });
  } catch (error) {
    console.error('Get specialities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve specialities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/specialities
// @desc    Create new speciality
// @access  Admin only
router.post('/specialities', async (req, res) => {
  try {
    const Speciality = require('../models/Speciality');
    const { name, description, isActive } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Speciality name is required'
      });
    }
    
    // Check for duplicates (case-insensitive)
    const existing = await Speciality.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Speciality with this name already exists'
      });
    }
    
    // Create speciality
    const speciality = new Speciality({
      name: name.trim(),
      description: description?.trim() || '',
      isActive: isActive !== undefined ? isActive : true,
      doctorCount: 0
    });
    
    await speciality.save();
    
    res.status(201).json({
      success: true,
      message: 'Speciality created successfully',
      speciality
    });
  } catch (error) {
    console.error('Create speciality error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create speciality',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/specialities/:id
// @desc    Update speciality
// @access  Admin only
router.put('/specialities/:id', async (req, res) => {
  try {
    const Speciality = require('../models/Speciality');
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    
    const speciality = await Speciality.findById(id);
    
    if (!speciality) {
      return res.status(404).json({
        success: false,
        message: 'Speciality not found'
      });
    }
    
    // Check for duplicate name (excluding current speciality)
    if (name && name.trim() !== speciality.name) {
      const existing = await Speciality.findOne({
        _id: { $ne: id },
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
      
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'Speciality with this name already exists'
        });
      }
    }
    
    // Update fields
    if (name !== undefined) speciality.name = name.trim();
    if (description !== undefined) speciality.description = description.trim();
    if (isActive !== undefined) speciality.isActive = isActive;
    
    await speciality.save();
    
    res.json({
      success: true,
      message: 'Speciality updated successfully',
      speciality
    });
  } catch (error) {
    console.error('Update speciality error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update speciality',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/specialities/:id
// @desc    Delete speciality
// @access  Admin only
router.delete('/specialities/:id', async (req, res) => {
  try {
    const Speciality = require('../models/Speciality');
    const { id } = req.params;
    
    const speciality = await Speciality.findById(id);
    
    if (!speciality) {
      return res.status(404).json({
        success: false,
        message: 'Speciality not found'
      });
    }
    
    // Check if any doctors are using this speciality
    const doctorCount = await User.countDocuments({ 
      userType: 'doctor',
      specialty: speciality.name 
    });
    
    if (doctorCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete speciality. ${doctorCount} doctor${doctorCount > 1 ? 's are' : ' is'} currently using this speciality. Please reassign them first.`
      });
    }
    
    // Hard delete since no doctors are using it
    await Speciality.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Speciality deleted successfully'
    });
  } catch (error) {
    console.error('Delete speciality error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete speciality',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== WALLET MANAGEMENT ====================

// @route   GET /api/admin/wallets
// @desc    Get all wallets with user details
// @access  Admin only
router.get('/wallets', async (req, res) => {
  try {
    const { page = 1, limit = 20, userType, sortBy = 'balance', sortOrder = 'desc' } = req.query;

    // Build aggregation pipeline
    const matchStage = {};
    
    const wallets = await Wallet.find(matchStage)
      .populate('user', 'username email userType firstName lastName companyName profilePicture companyLogo')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter by userType if specified
    let filteredWallets = wallets;
    if (userType && userType !== 'all') {
      filteredWallets = wallets.filter(w => w.user && w.user.userType === userType);
    }

    const count = await Wallet.countDocuments(matchStage);

    // Calculate total balances
    const totalBalance = filteredWallets.reduce((sum, w) => sum + w.balance, 0);
    const totalEarned = filteredWallets.reduce((sum, w) => sum + w.totalEarned, 0);
    const totalWithdrawn = filteredWallets.reduce((sum, w) => sum + w.totalWithdrawn, 0);

    res.json({
      success: true,
      wallets: filteredWallets,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
      summary: {
        totalBalance,
        totalEarned,
        totalWithdrawn
      }
    });
  } catch (error) {
    console.error('Get wallets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallets',
      error: error.message
    });
  }
});

// @route   GET /api/admin/wallets/:userId
// @desc    Get wallet details for a specific user
// @access  Admin only
router.get('/wallets/:userId', async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.params.userId })
      .populate('user', 'username email userType firstName lastName companyName')
      .populate('transactions.relatedEvent', 'title date')
      .populate('transactions.relatedJob', 'title location');

    if (!wallet) {
      // Create wallet if it doesn't exist
      wallet = new Wallet({
        user: req.params.userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: []
      });
      await wallet.save();
      await wallet.populate('user', 'username email userType firstName lastName companyName');
    }

    res.json({
      success: true,
      wallet
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve wallet',
      error: error.message
    });
  }
});

// @route   POST /api/admin/wallets/:userId/credit
// @desc    Manually credit amount to user wallet (admin)
// @access  Admin only
router.post('/wallets/:userId/credit', async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    let wallet = await Wallet.findOne({ user: req.params.userId });

    if (!wallet) {
      wallet = new Wallet({
        user: req.params.userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: []
      });
    }

    await wallet.addCredit(amount, description);
    await wallet.populate('user', 'username email userType firstName lastName companyName');

    res.json({
      success: true,
      message: 'Amount credited successfully',
      wallet
    });
  } catch (error) {
    console.error('Credit wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to credit wallet',
      error: error.message
    });
  }
});

// @route   POST /api/admin/wallets/:userId/debit
// @desc    Manually debit amount from user wallet (admin)
// @access  Admin only
router.post('/wallets/:userId/debit', async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    if (!description || !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    const wallet = await Wallet.findOne({ user: req.params.userId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    await wallet.deductAmount(amount, description);
    await wallet.populate('user', 'username email userType firstName lastName companyName');

    res.json({
      success: true,
      message: 'Amount debited successfully',
      wallet
    });
  } catch (error) {
    console.error('Debit wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debit wallet',
      error: error.message
    });
  }
});

// @route   GET /api/admin/withdrawal-requests
// @desc    Get all withdrawal requests
// @access  Admin only
router.get('/withdrawal-requests', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const withdrawalRequests = await WithdrawalRequest.find(query)
      .populate('user', 'username email userType firstName lastName companyName')
      .populate('processedBy', 'username email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await WithdrawalRequest.countDocuments(query);
    
    // Get summary stats
    const pendingCount = await WithdrawalRequest.countDocuments({ status: 'pending' });
    const approvedCount = await WithdrawalRequest.countDocuments({ status: 'approved' });
    const rejectedCount = await WithdrawalRequest.countDocuments({ status: 'rejected' });
    const completedCount = await WithdrawalRequest.countDocuments({ status: 'completed' });

    res.json({
      success: true,
      withdrawalRequests,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      total: count,
      summary: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        completed: completedCount
      }
    });
  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve withdrawal requests'
    });
  }
});

// @route   PUT /api/admin/withdrawal-requests/:id
// @desc    Update withdrawal request status (approve/reject/complete)
// @access  Admin only
router.put('/withdrawal-requests/:id', async (req, res) => {
  try {
    const { status, adminNote, transactionId } = req.body;

    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const withdrawalRequest = await WithdrawalRequest.findById(req.params.id);

    if (!withdrawalRequest) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Update status
    withdrawalRequest.status = status;
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = req.userId;
    
    if (adminNote) {
      withdrawalRequest.adminNote = adminNote;
    }
    
    if (transactionId) {
      withdrawalRequest.transactionId = transactionId;
    }

    await withdrawalRequest.save();
    
    // If approved, deduct amount from wallet
    if (status === 'completed') {
      const wallet = await Wallet.findOne({ user: withdrawalRequest.user });
      if (wallet && wallet.balance >= withdrawalRequest.amount) {
        await wallet.deductAmount(
          withdrawalRequest.amount,
          `Withdrawal to bank account - ${withdrawalRequest.bankDetails.accountNumber.slice(-4)}`
        );
      }
    }

    await withdrawalRequest.populate('user', 'username email userType firstName lastName companyName');
    await withdrawalRequest.populate('processedBy', 'username email');

    res.json({
      success: true,
      message: `Withdrawal request ${status} successfully`,
      withdrawalRequest
    });
  } catch (error) {
    console.error('Update withdrawal request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update withdrawal request'
    });
  }
});

module.exports = router;