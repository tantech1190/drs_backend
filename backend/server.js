const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const connectionRoutes = require('./routes/connections');
const chatRoutes = require('./routes/chat');
const documentRoutes = require('./routes/documents');
const eventRoutes = require('./routes/events');
const jobsRoutes = require('./routes/jobs');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const walletRoutes = require('./routes/wallet');

// Initialize express app
const app = express();

// ============================================================================
// CREATE HTTP SERVER WITH SOCKET.IO
// ============================================================================

const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://drsclub.org',
  'https://www.drsclub.org',
  'https://api.drsclub.org'   // ✅ ADD THIS
];

// Socket.IO Configuration
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// const io = socketIO(server, {
//   cors: {
//     origin: allowedOrigins,
//     methods: ['GET', 'POST'],
//     credentials: true
//   },
//   transports: ['websocket']   // force websocket in production
// });

// ============================================================================
// MIDDLEWARE
// ============================================================================

// app.use(cors());
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================================================
// MONGODB CONNECTION
// ============================================================================

const { PORT = 5000, MONGO_URI } = process.env;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log(`📊 Database: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ============================================================================
// SOCKET.IO SETUP
// ============================================================================

// Store online users and socket mappings
const onlineUsers = new Map(); // userId -> socketId
const userSockets = new Map(); // socketId -> userId
const userRooms = new Map();   // userId -> Set of roomIds

// ============================================================================
// SOCKET.IO AUTHENTICATION MIDDLEWARE
// ============================================================================

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      console.log('⚠️ Socket connection attempt without token');
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user data to socket
    socket.userId = decoded.userId || decoded.id;
    socket.userType = decoded.type || decoded.userType;
    
    console.log(`✅ Socket authenticated: User ${socket.userId} (${socket.userType})`);
    next();
  } catch (error) {
    console.error('❌ Socket authentication failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// ============================================================================
// SOCKET.IO EVENT HANDLERS
// ============================================================================

io.on('connection', (socket) => {
  const userId = socket.userId;
  
  console.log(`🟢 User connected: ${userId} (Socket: ${socket.id})`);
  
  // Track online user
  onlineUsers.set(userId, socket.id);
  userSockets.set(socket.id, userId);
  userRooms.set(userId, new Set());
  
  // Notify all clients that this user is online
  socket.broadcast.emit('userOnline', {
    userId: userId,
    isOnline: true
  });

  // ============================================================================
  // JOIN ROOM EVENT
  // ============================================================================
  
  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
    
    // Track room membership
    const rooms = userRooms.get(userId);
    if (rooms) {
      rooms.add(roomId);
    }
    
    console.log(`🚪 User ${userId} joined room: ${roomId}`);
  });

  // ============================================================================
  // LEAVE ROOM EVENT
  // ============================================================================
  
  socket.on('leaveRoom', ({ roomId }) => {
    socket.leave(roomId);
    
    // Remove from room tracking
    const rooms = userRooms.get(userId);
    if (rooms) {
      rooms.delete(roomId);
    }
    
    console.log(`🚪 User ${userId} left room: ${roomId}`);
  });

  // ============================================================================
  // SEND MESSAGE EVENT
  // ============================================================================
  
  socket.on('sendMessage', async ({ recipient, content, timestamp }) => {
    try {
      console.log(`📤 Message from ${userId} to ${recipient}:`, content.substring(0, 50));
      
      // Import Message model (make sure you have this model)
      const Message = mongoose.model('Message');
      
      // Save message to database
      const message = await Message.create({
        sender: userId,
        recipient: recipient,
        content: content,
        createdAt: timestamp || new Date(),
        read: false
      });

      // Populate sender and recipient if needed
      await message.populate('sender recipient');

      // Create room ID (consistent ordering)
      const roomId = createRoomId(userId, recipient);

      const messageData = {
        _id: message._id.toString(),
        sender: message.sender._id ? message.sender._id.toString() : userId,
        recipient: message.recipient._id ? message.recipient._id.toString() : recipient,
        content: message.content,
        createdAt: message.createdAt,
        read: message.read,
        updatedAt: message.updatedAt
      };

      // Emit to room (both sender and recipient)
      io.to(roomId).emit('newMessage', messageData);

      // Send confirmation to sender
      socket.emit('messageSent', messageData);

      console.log(`✅ Message saved and emitted to room ${roomId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('messageError', { 
        error: 'Failed to send message',
        message: error.message 
      });
    }
  });

  // ============================================================================
  // TYPING INDICATOR EVENTS
  // ============================================================================
  
  socket.on('typing', ({ roomId, recipientId }) => {
    console.log(`⌨️  User ${userId} is typing in room ${roomId}`);
    
    // Emit to recipient only (not sender)
    socket.to(roomId).emit('userTyping', {
      userId: userId,
      roomId: roomId,
      isTyping: true
    });
  });

  socket.on('stopTyping', ({ roomId, recipientId }) => {
    console.log(`⏸️  User ${userId} stopped typing in room ${roomId}`);
    
    socket.to(roomId).emit('userStoppedTyping', {
      userId: userId,
      roomId: roomId,
      isTyping: false
    });
  });

  // ============================================================================
  // DISCONNECT EVENT
  // ============================================================================
  
  socket.on('disconnect', (reason) => {
    console.log(`🔴 User disconnected: ${userId} (Socket: ${socket.id}) - Reason: ${reason}`);
    
    // Remove from online users
    onlineUsers.delete(userId);
    userSockets.delete(socket.id);
    userRooms.delete(userId);
    
    // Notify all clients that this user is offline
    socket.broadcast.emit('userOffline', {
      userId: userId,
      isOnline: false
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================
  
  socket.on('error', (error) => {
    console.error(`❌ Socket error for user ${userId}:`, error);
  });
});

// ============================================================================
// HELPER FUNCTIONS FOR SOCKET.IO
// ============================================================================

/**
 * Create a consistent room ID from two user IDs
 */
function createRoomId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `chat_${ids[0]}_${ids[1]}`;
}

/**
 * Check if a user is online
 */
function isUserOnline(userId) {
  return onlineUsers.has(userId.toString());
}

/**
 * Get socket ID for a user
 */
function getSocketId(userId) {
  return onlineUsers.get(userId.toString());
}

// Make io accessible to routes if needed
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// ============================================================================
// API ROUTES
// ============================================================================

app.use('/api/public', publicRoutes);  // Public routes FIRST (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wallet', walletRoutes);

// ============================================================================
// HEALTH CHECK & DEBUG ROUTES
// ============================================================================

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Drs Club API is running',
    socketIO: 'enabled',
    onlineUsers: onlineUsers.size
  });
});

// Debug: Get online users (for development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/online-users', (req, res) => {
    const users = Array.from(onlineUsers.entries()).map(([userId, socketId]) => ({
      userId,
      socketId
    }));
    res.json({ 
      onlineUsers: users,
      count: users.length 
    });
  });
}

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// ============================================================================
// START SERVER (USE server.listen, NOT app.listen!)
// ============================================================================

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO enabled on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log('='.repeat(50));
});

module.exports = { app, server, io };
