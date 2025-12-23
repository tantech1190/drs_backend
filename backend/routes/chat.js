const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// @route   GET /api/chat/conversations
// @desc    Get all conversations for user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    // Get all unique users that current user has chatted with
    const messages = await Message.find({
      $or: [
        { sender: req.userId },
        { recipient: req.userId }
      ]
    }).sort({ createdAt: -1 });

    // Extract unique conversation partners
    const conversationPartners = new Set();
    messages.forEach(msg => {
      if (msg.sender.toString() !== req.userId) {
        conversationPartners.add(msg.sender.toString());
      }
      if (msg.recipient.toString() !== req.userId) {
        conversationPartners.add(msg.recipient.toString());
      }
    });

    // Get user details for each conversation partner
    const conversations = await Promise.all(
      Array.from(conversationPartners).map(async (partnerId) => {
        const partner = await User.findById(partnerId).select('username firstName lastName companyName userType profilePicture companyLogo');
        
        // Get last message
        const lastMessage = await Message.findOne({
          $or: [
            { sender: req.userId, recipient: partnerId },
            { sender: partnerId, recipient: req.userId }
          ]
        }).sort({ createdAt: -1 });

        // Count unread messages
        const unreadCount = await Message.countDocuments({
          sender: partnerId,
          recipient: req.userId,
          read: false
        });

        return {
          partner,
          lastMessage,
          unreadCount
        };
      })
    );

    // Sort by last message time
    conversations.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(0);
      const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(0);
      return timeB - timeA;
    });

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching conversations' });
  }
});

// @route   GET /api/chat/messages/:userId
// @desc    Get messages with specific user
// @access  Private
router.get('/messages/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if users are connected
    const currentUser = await User.findById(req.userId);
    const isConnected = currentUser.connections.some(
      conn => conn.toString() === userId
    );

    if (!isConnected) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only chat with connected users' 
      });
    }

    // Get messages
    const messages = await Message.find({
      $or: [
        { sender: req.userId, recipient: userId },
        { sender: userId, recipient: req.userId }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(100);

    // Mark messages as read
    await Message.updateMany(
      {
        sender: userId,
        recipient: req.userId,
        read: false
      },
      {
        read: true,
        readAt: new Date()
      }
    );

    res.json({
      success: true,
      messages
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages' });
  }
});

// @route   POST /api/chat/send
// @desc    Send message
// @access  Private
router.post('/send', auth, async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // Check if users are connected
    const currentUser = await User.findById(req.userId);
    const isConnected = currentUser.connections.some(
      conn => conn.toString() === recipientId
    );

    if (!isConnected) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only send messages to connected users' 
      });
    }

    // Create message
    const message = new Message({
      sender: req.userId,
      recipient: recipientId,
      content: content.trim()
    });

    await message.save();

    // Populate sender info
    await message.populate('sender', 'username firstName lastName companyName userType');

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message' });
  }
});

// @route   PUT /api/chat/mark-read/:messageId
// @desc    Mark message as read
// @access  Private
router.put('/mark-read/:messageId', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (message.recipient.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    message.read = true;
    message.readAt = new Date();
    await message.save();

    res.json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Error marking message as read' });
  }
});

// @route   GET /api/chat/unread-count
// @desc    Get total unread message count
// @access  Private
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.userId,
      read: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, message: 'Error fetching unread count' });
  }
});

module.exports = router;
