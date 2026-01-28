const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['medical-license', 'degree', 'board-certification', 'other'],
    required: true
  },
  category: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  fileSize: Number,
  mimeType: String,
  startDate: Date,
  expiryDate: Date,
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  notes: String
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Map backend type to frontend documentType
      const typeMap = {
        'medical-license': 'license',
        'degree': 'degree',
        'board-certification': 'certification',
        'other': 'other'
      };
      
      // Transform field names to match frontend expectations
      return {
        _id: ret._id,
        user: ret.user,  // Include populated user data
        name: ret.title,
        documentType: typeMap[ret.type] || ret.type,
        category: ret.category,
        fileUrl: ret.filePath,
        uploadDate: ret.createdAt,
        startDate: ret.startDate,
        expiryDate: ret.expiryDate,
        verified: ret.isVerified,
        fileSize: ret.fileSize,
        mimeType: ret.mimeType
      };
    }
  }
});

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;