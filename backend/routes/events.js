const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Wallet = require('../models/Wallet');
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// @route   GET /api/events
// @desc    Get all events
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { type, status, upcoming } = req.query;
    
    let query = {};

    if (type) {
      query.type = type;
    }

    if (status) {
      query.status = status;
    } else if (upcoming) {
      query.date = { $gte: new Date() };
      query.status = 'upcoming';
    }

    const events = await Event.find(query)
      .populate('organizer', 'username firstName lastName companyName userType')
      .sort({ date: 1 })
      .limit(50);

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Error fetching events' });
  }
});

// @route   GET /api/events/:id
// @desc    Get single event
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'username firstName lastName companyName userType profilePicture companyLogo')
      .populate('attendees.user', 'username firstName lastName companyName userType');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ success: false, message: 'Error fetching event' });
  }
});

// @route   POST /api/events
// @desc    Create new event
// @access  Private
router.post('/', auth, uploadImage.array('image', 10), async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      endDate,
      location,
      type,
      maxAttendees,
      isVirtual,
      virtualLink,
      tags
    } = req.body;

    const event = new Event({
      title,
      description,
      date,
      endDate,
      location,
      type,
      organizer: req.userId,
      maxAttendees,
      isVirtual: isVirtual === 'true',
      virtualLink,
      tags: tags ? JSON.parse(tags) : []
    });

    // Handle multiple images
    if (req.files && req.files.length > 0) {
      event.images = req.files.map(file => '/uploads/images/' + file.filename);
    }

    await event.save();

    // Credit wallet for event creation (5 rupees)
    try {
      let wallet = await Wallet.findOne({ user: req.userId });
      
      if (!wallet) {
        wallet = new Wallet({
          user: req.userId,
          balance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          transactions: []
        });
      }
      
      await wallet.addCredit(
        5, 
        `Event created: ${title}`,
        event._id
      );
      
      console.log(`Wallet credited: $5 for event creation by user ${req.userId}`);
    } catch (walletError) {
      console.error('Wallet credit error:', walletError);
      // Don't fail event creation if wallet credit fails
    }

    res.status(201).json({
      success: true,
      message: 'Event created successfully. $5 credited to your wallet!',
      event
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Error creating event' });
  }
});

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (organizer only)
router.put('/:id', auth, uploadImage.array('image', 10), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this event' });
    }

    const allowedUpdates = ['title', 'description', 'date', 'endDate', 'location', 'type', 'maxAttendees', 'isVirtual', 'virtualLink', 'tags', 'status'];
    const updates = Object.keys(req.body);

    updates.forEach(update => {
      if (allowedUpdates.includes(update)) {
        if (update === 'tags' && typeof req.body[update] === 'string') {
          event[update] = JSON.parse(req.body[update]);
        } else {
          event[update] = req.body[update];
        }
      }
    });

    // Handle multiple images - append to existing images array
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => '/uploads/images/' + file.filename);
      event.images = event.images ? [...event.images, ...newImages] : newImages;
    }

    await event.save();

    res.json({
      success: true,
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, message: 'Error updating event' });
  }
});

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (organizer only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.organizer.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this event' });
    }

    await event.deleteOne();

    res.json({
      success: true,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Error deleting event' });
  }
});

// @route   POST /api/events/:id/register
// @desc    Register for event
// @access  Private
router.post('/:id/register', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if already registered
    const alreadyRegistered = event.attendees.some(
      attendee => attendee.user.toString() === req.userId
    );

    if (alreadyRegistered) {
      return res.status(400).json({ success: false, message: 'Already registered for this event' });
    }

    // Check max attendees
    if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
      return res.status(400).json({ success: false, message: 'Event is full' });
    }

    event.attendees.push({
      user: req.userId,
      status: 'registered'
    });

    await event.save();

    res.json({
      success: true,
      message: 'Successfully registered for event',
      event
    });
  } catch (error) {
    console.error('Register for event error:', error);
    res.status(500).json({ success: false, message: 'Error registering for event' });
  }
});

// @route   POST /api/events/:id/unregister
// @desc    Unregister from event
// @access  Private
router.post('/:id/unregister', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    event.attendees = event.attendees.filter(
      attendee => attendee.user.toString() !== req.userId
    );

    await event.save();

    res.json({
      success: true,
      message: 'Successfully unregistered from event',
      event
    });
  } catch (error) {
    console.error('Unregister from event error:', error);
    res.status(500).json({ success: false, message: 'Error unregistering from event' });
  }
});

// @route   GET /api/events/my/registered
// @desc    Get events user is registered for
// @access  Private
router.get('/my/registered', auth, async (req, res) => {
  try {
    const events = await Event.find({
      'attendees.user': req.userId
    })
    .populate('organizer', 'username firstName lastName companyName userType')
    .sort({ date: 1 });

    res.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Get registered events error:', error);
    res.status(500).json({ success: false, message: 'Error fetching registered events' });
  }
});

module.exports = router;