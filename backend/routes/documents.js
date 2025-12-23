const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { auth, isDoctor } = require('../middleware/auth');
const { uploadDocument } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// @route   GET /api/documents
// @desc    Get all documents for current user
// @access  Private (Doctors only)
router.get('/', auth, isDoctor, async (req, res) => {
  try {
    const documents = await Document.find({ user: req.userId }).sort({ createdAt: -1 });

    console.log(`Found ${documents.length} documents for user ${req.userId}`);
    
    // Transform documents to match frontend expectations
    const transformedDocuments = documents.map(doc => {
      const typeMap = {
        'medical-license': 'license',
        'degree': 'degree',
        'board-certification': 'certification',
        'other': 'other'
      };
      
      return {
        _id: doc._id,
        name: doc.title,
        documentType: typeMap[doc.type] || doc.type,
        category: doc.category,
        fileUrl: doc.filePath,
        uploadDate: doc.createdAt,
        startDate: doc.startDate,
        expiryDate: doc.expiryDate,
        verified: doc.isVerified,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType
      };
    });
    
    res.json({
      success: true,
      documents: transformedDocuments
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents' });
  }
});

// @route   POST /api/documents/upload
// @desc    Upload a new document
// @access  Private (Doctors only)
router.post('/upload', auth, isDoctor, uploadDocument.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { documentType, title, type, notes, category, startDate, expiryDate } = req.body;

    // Map frontend documentType to backend type
    const typeMap = {
      'license': 'medical-license',
      'degree': 'degree',
      'certification': 'board-certification',
      'other': 'other'
    };

    // Use documentType if provided, otherwise fall back to type
    const docTypeValue = documentType || type || 'other';
    const backendType = typeMap[docTypeValue] || docTypeValue;

    const document = new Document({
      user: req.userId,
      title: title || req.file.originalname,
      type: backendType,
      fileName: req.file.originalname,
      filePath: '/uploads/documents/' + req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      category: category,
      startDate: startDate ? new Date(startDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      notes
    });

    await document.save();

    // Transform document for frontend
    const reverseTypeMap = {
      'medical-license': 'license',
      'degree': 'degree',
      'board-certification': 'certification',
      'other': 'other'
    };

    const transformedDocument = {
      _id: document._id,
      name: document.title,
      documentType: reverseTypeMap[document.type] || document.type,
      category: document.category,
      fileUrl: document.filePath,
      uploadDate: document.createdAt,
      startDate: document.startDate,
      expiryDate: document.expiryDate,
      verified: document.isVerified,
      fileSize: document.fileSize,
      mimeType: document.mimeType
    };

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: transformedDocument
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Error uploading document' });
  }
});

// @route   PUT /api/documents/:id
// @desc    Update document details
// @access  Private (Doctors only)
router.put('/:id', auth, isDoctor, async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, user: req.userId });

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const { title, type, notes } = req.body;

    if (title) document.title = title;
    if (type) document.type = type;
    if (notes !== undefined) document.notes = notes;

    await document.save();

    res.json({
      success: true,
      message: 'Document updated successfully',
      document
    });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ success: false, message: 'Error updating document' });
  }
});

// @route   DELETE /api/documents/:id
// @desc    Delete document
// @access  Private (Doctors only)
router.delete('/:id', auth, isDoctor, async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, user: req.userId });

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '..', document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await document.deleteOne();

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ success: false, message: 'Error deleting document' });
  }
});

// @route   GET /api/documents/download/:id
// @desc    Download document
// @access  Private (Doctors only)
router.get('/download/:id', auth, isDoctor, async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, user: req.userId });

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const filePath = path.join(__dirname, '..', document.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.download(filePath, document.fileName);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ success: false, message: 'Error downloading document' });
  }
});

module.exports = router;