const mongoose = require('mongoose');

const specialitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Speciality name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Speciality name must be at least 2 characters'],
    maxlength: [100, 'Speciality name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  doctorCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
specialitySchema.index({ name: 1 });
specialitySchema.index({ isActive: 1 });
specialitySchema.index({ name: 1, isActive: 1 });

// Virtual to ensure case-insensitive uniqueness
specialitySchema.pre('save', async function(next) {
  if (this.isModified('name')) {
    const existing = await this.constructor.findOne({
      _id: { $ne: this._id },
      name: { $regex: new RegExp(`^${this.name}$`, 'i') }
    });
    
    if (existing) {
      const error = new Error('A speciality with this name already exists');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Speciality', specialitySchema);
