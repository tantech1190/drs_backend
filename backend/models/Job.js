const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Locum', 'Fellowship'],
    required: true
  },
  location: {
    type: String,
    required: true
  },
  salary: {
    type: String
  },
  specialty: {
    type: String,
    required: true
  },
  experience: {
    type: String,
    required: true
  },
  requirements: {
    type: String,
    required: true
  },
  images: [String], // Array of image paths
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  applicants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'shortlisted', 'rejected'],
      default: 'pending'
    }
  }],
  status: {
    type: String,
    enum: ['active', 'closed', 'filled'],
    default: 'active'
  },
  deadline: Date
}, {
  timestamps: true
});

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;