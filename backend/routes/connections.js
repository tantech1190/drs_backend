const express = require('express');
const router = express.Router();
const Connection = require('../models/Connection');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// @route   POST /api/connections/request
// @desc    Send connection request
// @access  Private
router.post('/request', auth, async (req, res) => {
  try {
    const { recipientId, message } = req.body;

    if (recipientId === req.userId) {
      return res.status(400).json({ success: false, message: 'Cannot connect with yourself' });
    }

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: recipientId },
        { requester: recipientId, recipient: req.userId }
      ]
    });

    if (existingConnection) {
      return res.status(400).json({ 
        success: false, 
        message: 'Connection request already exists or you are already connected' 
      });
    }

    // Create connection request
    const connection = new Connection({
      requester: req.userId,
      recipient: recipientId,
      message,
      status: 'pending'
    });

    await connection.save();

    // Add to recipient's pending requests
    recipient.pendingRequests.push(req.userId);
    await recipient.save();

    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully',
      connection
    });
  } catch (error) {
    console.error('Send connection request error:', error);
    res.status(500).json({ success: false, message: 'Error sending connection request' });
  }
});

// @route   GET /api/connections/pending
// @desc    Get pending connection requests
// @access  Private
router.get('/pending', auth, async (req, res) => {
  try {
    const pendingRequests = await Connection.find({
      recipient: req.userId,
      status: 'pending'
    })
    .populate('requester', 'username firstName lastName companyName userType city state profilePicture companyLogo')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests: pendingRequests
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending requests' });
  }
});

// @route   POST /api/connections/accept/:connectionId
// @desc    Accept connection request
// @access  Private
router.post('/accept/:connectionId', auth, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    if (connection.recipient.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Connection request already processed' });
    }

    // Update connection status
    connection.status = 'accepted';
    await connection.save();

    // Add to both users' connections
    await User.findByIdAndUpdate(connection.requester, {
      $push: { connections: connection.recipient },
      $pull: { pendingRequests: connection.recipient }
    });

    await User.findByIdAndUpdate(connection.recipient, {
      $push: { connections: connection.requester },
      $pull: { pendingRequests: connection.requester }
    });

    res.json({
      success: true,
      message: 'Connection accepted successfully',
      connection
    });
  } catch (error) {
    console.error('Accept connection error:', error);
    res.status(500).json({ success: false, message: 'Error accepting connection' });
  }
});

// @route   POST /api/connections/reject/:connectionId
// @desc    Reject connection request
// @access  Private
router.post('/reject/:connectionId', auth, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId);

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    if (connection.recipient.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (connection.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Connection request already processed' });
    }

    // Update connection status
    connection.status = 'rejected';
    await connection.save();

    // Remove from recipient's pending requests
    await User.findByIdAndUpdate(connection.recipient, {
      $pull: { pendingRequests: connection.requester }
    });

    res.json({
      success: true,
      message: 'Connection rejected',
      connection
    });
  } catch (error) {
    console.error('Reject connection error:', error);
    res.status(500).json({ success: false, message: 'Error rejecting connection' });
  }
});

// @route   GET /api/connections/my-connections
// @desc    Get user's connections
// @access  Private
router.get('/my-connections', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('connections', 'username firstName lastName companyName userType specialty category city state profilePicture companyLogo');

    res.json({
      success: true,
      connections: user.connections
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({ success: false, message: 'Error fetching connections' });
  }
});

// @route   DELETE /api/connections/:userId
// @desc    Remove connection
// @access  Private
router.delete('/:userId', auth, async (req, res) => {
  try {
    // Remove connection from both users
    await User.findByIdAndUpdate(req.userId, {
      $pull: { connections: req.params.userId }
    });

    await User.findByIdAndUpdate(req.params.userId, {
      $pull: { connections: req.userId }
    });

    // Update connection record
    await Connection.findOneAndUpdate(
      {
        $or: [
          { requester: req.userId, recipient: req.params.userId },
          { requester: req.params.userId, recipient: req.userId }
        ]
      },
      { status: 'rejected' }
    );

    res.json({
      success: true,
      message: 'Connection removed successfully'
    });
  } catch (error) {
    console.error('Remove connection error:', error);
    res.status(500).json({ success: false, message: 'Error removing connection' });
  }
});

module.exports = router;
