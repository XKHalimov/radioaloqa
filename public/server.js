// server.js - Node.js Backend Server
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// Static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Room data structure
const rooms = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Yangi foydalanuvchi ulandi:', socket.id);

  // User xonaga qo'shildi
  socket.on('join-room', ({ roomId, username }) => {
    console.log(`📥 ${username} (${socket.id}) xonaga qo'shilmoqda: ${roomId}`);
    
    socket.join(roomId);
    
    // Xona mavjud emasligini tekshirish
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
      console.log(`🏠 Yangi xona yaratildi: ${roomId}`);
    }
    
    const room = rooms.get(roomId);
    room.set(socket.id, { 
      username, 
      socketId: socket.id,
      connectionQuality: 'yaxshi',
      joinedAt: Date.now()
    });

    // Mavjud userlarga yangi user haqida xabar berish
    const otherUsers = Array.from(room.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ socketId: id, username: data.username }));
    
    console.log(`👥 Xonada ${otherUsers.length} ta boshqa user mavjud`);

    // Yangi userga mavjud userlar ro'yxatini yuborish
    socket.emit('existing-users', otherUsers);
    
    // Boshqa userlarga yangi user haqida xabar berish
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username
    });

    console.log(`✅ ${username} xonaga qo'shildi. Jami: ${room.size} user`);
  });

  // WebRTC Offer
  socket.on('offer', ({ to, offer }) => {
    console.log(`📤 Offer yuborilmoqda: ${socket.id} → ${to}`);
    socket.to(to).emit('offer', {
      from: socket.id,
      offer
    });
  });

  // WebRTC Answer
  socket.on('answer', ({ to, answer }) => {
    console.log(`📤 Answer yuborilmoqda: ${socket.id} → ${to}`);
    socket.to(to).emit('answer', {
      from: socket.id,
      answer
    });
  });

  // ICE Candidate
  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`📤 ICE candidate yuborilmoqda: ${socket.id} → ${to}`);
    socket.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  });

  // Chat xabarlari
  socket.on('chat-message', ({ roomId, username, message }) => {
    console.log(`💬 Chat: ${username} (${roomId}): ${message}`);
    io.to(roomId).emit('chat-message', {
      username,
      message,
      timestamp: Date.now()
    });
  });

  // Connection quality update
  socket.on('connection-quality', ({ roomId, quality }) => {
    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      room.get(socket.id).connectionQuality = quality;
      socket.to(roomId).emit('user-quality-update', {
        socketId: socket.id,
        quality
      });
    }
  });

  // User disconnect
  socket.on('disconnect', () => {
    console.log('❌ Foydalanuvchi uzildi:', socket.id);
    
    // Barcha xonalardan topish va o'chirish
    rooms.forEach((room, roomId) => {
      if (room.has(socket.id)) {
        const userData = room.get(socket.id);
        room.delete(socket.id);
        
        // Boshqa userlarga xabar berish
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: userData.username
        });

        console.log(`👋 ${userData.username} chiqdi. ${roomId} xonada ${room.size} user qoldi`);

        // Agar xona bo'sh bo'lsa, o'chirish
        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Bo'sh xona o'chirildi: ${roomId}`);
        }
      }
    });
  });

  // Error handling
  socket.on('error', (error) => {
    console.error('❌ Socket xatolik:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    rooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Server status
app.get('/api/stats', (req, res) => {
  const stats = {
    totalRooms: rooms.size,
    rooms: []
  };
  
  rooms.forEach((room, roomId) => {
    stats.rooms.push({
      roomId,
      users: room.size,
      usernames: Array.from(room.values()).map(u => u.username)
    });
  });
  
  res.json(stats);
});

// Start server
server.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log(`🎥 Video Chat Server ishga tushdi!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('🚀 ========================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal olindi. Server yopilmoqda...');
  server.close(() => {
    console.log('Server yopildi');
    process.exit(0);
  });
});