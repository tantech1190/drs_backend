const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { auth } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

// @route   GET /api/jobs
// @desc    Get all jobs
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { type, location, specialty, status } = req.query;
    
    let query = {};

    if (type) {
      query.type = type;
    }

    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    if (specialty) {
      query.specialty = specialty;
    }

    if (status) {
      query.status = status;
    }

    const jobs = await Job.find(query)
      .populate('postedBy', 'username firstName lastName companyName userType')
      .sort({ createdAt: -1 })
      .limit(100);

    // Filter out jobs where postedBy user was deleted
    const validJobs = jobs.filter(job => job.postedBy !== null);

    res.json({
      success: true,
      jobs: validJobs
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching jobs' });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get single job
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('postedBy', 'username firstName lastName companyName userType profilePicture companyLogo')
      .populate('applicants.user', 'username firstName lastName userType');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.json({
      success: true,
      job
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ success: false, message: 'Error fetching job' });
  }
});

// @route   POST /api/jobs
// @desc    Create new job
// @access  Private
router.post('/', auth, uploadImage.array('image', 10), async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      location,
      salary,
      specialty,
      experience,
      requirements
    } = req.body;

    const job = new Job({
      title,
      description,
      type,
      location,
      salary,
      specialty,
      experience,
      requirements,
      postedBy: req.userId,
      status: 'active'
    });

    // Handle multiple images
    if (req.files && req.files.length > 0) {
      job.images = req.files.map(file => '/uploads/images/' + file.filename);
    }

    await job.save();

    // Populate postedBy before sending response
    await job.populate('postedBy', 'username firstName lastName companyName userType');

    res.status(201).json({
      success: true,
      message: 'Job created successfully',
      job
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ success: false, message: 'Error creating job' });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update job
// @access  Private (poster only)
router.put('/:id', auth, uploadImage.array('image', 10), async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.postedBy.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    const allowedUpdates = ['title', 'description', 'type', 'location', 'salary', 'specialty', 'experience', 'requirements', 'status'];
    const updates = Object.keys(req.body);

    updates.forEach(update => {
      if (allowedUpdates.includes(update)) {
        job[update] = req.body[update];
      }
    });

    // Handle multiple images - append to existing images array
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => '/uploads/images/' + file.filename);
      job.images = job.images ? [...job.images, ...newImages] : newImages;
    }

    await job.save();

    // Populate postedBy before sending response
    await job.populate('postedBy', 'username firstName lastName companyName userType');

    res.json({
      success: true,
      message: 'Job updated successfully',
      job
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ success: false, message: 'Error updating job' });
  }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete job
// @access  Private (poster only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.postedBy.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await job.deleteOne();

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ success: false, message: 'Error deleting job' });
  }
});

// @route   POST /api/jobs/:id/apply
// @desc    Apply for job
// @access  Private
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if already applied
    const alreadyApplied = job.applicants.some(
      applicant => applicant.user.toString() === req.userId
    );

    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'Already applied for this job' });
    }

    job.applicants.push({
      user: req.userId,
      status: 'pending'
    });

    await job.save();

    // Populate postedBy before sending response
    await job.populate('postedBy', 'username firstName lastName companyName userType');

    res.json({
      success: true,
      message: 'Application submitted successfully',
      job
    });
  } catch (error) {
    console.error('Apply for job error:', error);
    res.status(500).json({ success: false, message: 'Error applying for job' });
  }
});

// @route   GET /api/jobs/my/applications
// @desc    Get jobs user has applied to
// @access  Private
router.get('/my/applications', auth, async (req, res) => {
  try {
    const jobs = await Job.find({
      'applicants.user': req.userId
    })
    .populate('postedBy', 'username firstName lastName companyName userType')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, message: 'Error fetching applications' });
  }
});

// @route   GET /api/jobs/my/posted
// @desc    Get jobs posted by user
// @access  Private
router.get('/my/posted', auth, async (req, res) => {
  try {
    const jobs = await Job.find({
      postedBy: req.userId
    })
    .populate('applicants.user', 'username firstName lastName userType')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      jobs
    });
  } catch (error) {
    console.error('Get posted jobs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching posted jobs' });
  }
});

module.exports = router;