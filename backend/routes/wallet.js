const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { auth } = require('../middleware/auth');

// Get user's wallet
router.get('/', auth, async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.userId })
      .populate('transactions.relatedEvent', 'title date')
      .populate('transactions.relatedJob', 'title location');
    
    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = new Wallet({
        user: req.userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: []
      });
      await wallet.save();
    }
    
    res.json({
      success: true,
      wallet
    });
  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet',
      error: error.message
    });
  }
});

// Get wallet transactions with pagination
router.get('/transactions', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const wallet = await Wallet.findOne({ user: req.userId })
      .populate('transactions.relatedEvent', 'title date')
      .populate('transactions.relatedJob', 'title location');
    
    if (!wallet) {
      return res.json({
        success: true,
        transactions: [],
        total: 0,
        page,
        totalPages: 0
      });
    }
    
    // Sort transactions by date (newest first)
    const sortedTransactions = wallet.transactions.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      transactions: paginatedTransactions,
      total: sortedTransactions.length,
      page,
      totalPages: Math.ceil(sortedTransactions.length / limit)
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

// Manual credit (admin only - to be called from events.js when event is created)
router.post('/credit', auth, async (req, res) => {
  try {
    const { userId, amount, description, relatedEvent, relatedJob } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    let wallet = await Wallet.findOne({ user: userId });
    
    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        transactions: []
      });
    }
    
    await wallet.addCredit(amount, description, relatedEvent, relatedJob);
    
    res.json({
      success: true,
      message: 'Amount credited successfully',
      wallet
    });
  } catch (error) {
    console.error('Error crediting wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to credit wallet',
      error: error.message
    });
  }
});

// Request withdrawal
router.post('/withdrawal-request', auth, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    
    // Validation
    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is $10'
      });
    }
    
    if (!bankDetails || !bankDetails.accountHolderName || !bankDetails.accountNumber || 
        !bankDetails.ifscCode || !bankDetails.bankName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide complete bank details'
      });
    }
    
    // Check wallet balance
    const wallet = await Wallet.findOne({ user: req.userId });
    
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
    
    // Check for pending withdrawal requests
    const pendingRequest = await WithdrawalRequest.findOne({
      user: req.userId,
      status: 'pending'
    });
    
    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending withdrawal request'
      });
    }
    
    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      user: req.userId,
      amount,
      bankDetails
    });
    
    await withdrawalRequest.save();
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      request: withdrawalRequest
    });
  } catch (error) {
    console.error('Error creating withdrawal request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create withdrawal request',
      error: error.message
    });
  }
});

// Get user's withdrawal requests
router.get('/withdrawal-requests', auth, async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ user: req.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error fetching withdrawal requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal requests',
      error: error.message
    });
  }
});

// Request withdrawal (future implementation)
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    const wallet = await Wallet.findOne({ user: req.userId });
    
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
    
    // For now, just return success - implement actual withdrawal logic later
    res.json({
      success: true,
      message: 'Withdrawal request submitted. This feature is coming soon.',
      availableBalance: wallet.balance
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal',
      error: error.message
    });
  }
});

module.exports = router;