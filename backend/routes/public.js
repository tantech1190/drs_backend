const express = require('express');
const router = express.Router();
const Speciality = require('../models/Speciality');

/**
 * @route   GET /api/public/specialities
 * @desc    Get all active specialities (public endpoint - no authentication required)
 * @access  Public
 */
router.get('/specialities', async (req, res) => {
  try {
    const specialities = await Speciality.find({ isActive: true })
      .select('name description isActive createdAt updatedAt')
      .sort({ name: 1 })
      .lean();
    
    res.json({
      success: true,
      count: specialities.length,
      specialities
    });
  } catch (error) {
    console.error('Error fetching public specialities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch specialities',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/public/specialities/stats
 * @desc    Get public statistics about specialities
 * @access  Public
 */
router.get('/specialities/stats', async (req, res) => {
  try {
    const totalActive = await Speciality.countDocuments({ isActive: true });
    
    res.json({
      success: true,
      stats: {
        totalActive
      }
    });
  } catch (error) {
    console.error('Error fetching speciality stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch speciality statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
