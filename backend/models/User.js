const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userType: {
    type: String,
    enum: ['doctor', 'vendor', 'admin'],
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isOnboarded: {
    type: Boolean,
    default: false
  },
  
  // Doctor-specific fields
  firstName: String,
  lastName: String,
  specialty: String,
  subSpecialty: String,
  phone: String,
  location: String,
  city: String,
  state: String,
  zip: String,
  bio: String,
  profilePicture: String,
  
  // Job status for doctors
  jobStatus: {
    type: String,
    enum: ['none', 'looking_for_job', 'hiring'],
    default: 'none'
  },
  
  // Privacy settings
  showJobStatus: {
    type: Boolean,
    default: true
  },
  showPhone: {
    type: Boolean,
    default: true
  },
  showEmail: {
    type: Boolean,
    default: false
  },
  showLocation: {
    type: Boolean,
    default: true
  },
  showBio: {
    type: Boolean,
    default: true
  },
  
  // Verification fields for doctors
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Vendor-specific fields
  companyName: String,
  contactPerson: String,
  category: String,
  website: String,
  address: String,
  description: String,
  servicesOffered: String,
  companyLogo: String,
  businessLicense: String,
  
  // Subscription for vendors
  subscription: {
    plan: {
      type: String,
      enum: ['monthly', 'yearly', 'none'],
      default: 'none'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'expired'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    amount: Number
  },
  
  // Featured vendor promotion
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredUntil: Date,
  
  // Awards & Achievements (for event organizers)
  awards: [{
    awardType: {
      type: String,
      enum: ['star', 'trophy', 'crown', 'shield', 'zap'],
      required: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    grantedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  
  // Bank details (for withdrawals) - USA specific
  bankDetails: {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    routingNumber: String,
    accountType: {
      type: String,
      enum: ['checking', 'savings'],
      default: 'checking'
    }
  },
  
  // Connections
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Pending connection requests
  pendingRequests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLogin: Date
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (limited info before connection)
userSchema.methods.getPublicProfile = function() {
  const publicProfile = {
    _id: this._id,
    username: this.username,
    userType: this.userType,
    firstName: this.firstName,
    lastName: this.lastName,
    companyName: this.companyName,
    city: this.city,
    state: this.state,
    specialty: this.specialty,
    category: this.category,
    profilePicture: this.profilePicture,
    companyLogo: this.companyLogo,
    emailVerified: this.emailVerified,
    phoneVerified: this.phoneVerified,
    isFeatured: this.isFeatured
  };
  
  // Include job status if doctor and set to show
  if (this.userType === 'doctor' && this.showJobStatus && this.jobStatus) {
    publicProfile.jobStatus = this.jobStatus;
  }
  
  return publicProfile;
};

// Get full profile (after connection)
userSchema.methods.getFullProfile = function() {
  const profile = this.toObject();
  delete profile.password;
  
  // Respect privacy settings for job status only
  if (this.userType === 'doctor') {
    // Hide job status if privacy setting is off
    if (this.showJobStatus === false || !this.jobStatus || this.jobStatus === 'none') {
      delete profile.jobStatus;
    }
  }
  
  return profile;
};

const User = mongoose.model('User', userSchema);

module.exports = User;