const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  endDate: Date,
  location: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['conference', 'webinar', 'networking', 'workshop', 'other'],
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled'],
      default: 'registered'
    },
    registeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxAttendees: Number,
  images: [String], // Changed from single image to array of images
  isVirtual: {
    type: Boolean,
    default: false
  },
  virtualLink: String,
  tags: [String],
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  }
}, {
  timestamps: true
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
