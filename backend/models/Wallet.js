const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  relatedEvent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  relatedJob: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job'
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  transactions: [transactionSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Method to add credit
walletSchema.methods.addCredit = async function(amount, description, relatedEvent = null, relatedJob = null) {
  this.balance += amount;
  this.totalEarned += amount;
  
  this.transactions.push({
    type: 'credit',
    amount,
    description,
    relatedEvent,
    relatedJob,
    balanceAfter: this.balance,
    createdAt: new Date()
  });
  
  await this.save();
  return this;
};

// Method to deduct amount
walletSchema.methods.deductAmount = async function(amount, description) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  this.balance -= amount;
  this.totalWithdrawn += amount;
  
  this.transactions.push({
    type: 'debit',
    amount,
    description,
    balanceAfter: this.balance,
    createdAt: new Date()
  });
  
  await this.save();
  return this;
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;
