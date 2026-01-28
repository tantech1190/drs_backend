const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 10 // Minimum withdrawal amount
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  adminNote: {
    type: String
  },
  transactionId: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
withdrawalRequestSchema.index({ user: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);