const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    room.set(socket.id, {
      username,
      socketId: socket.id,
      connectionQuality: "yaxshi",
    });

    socket.to(roomId).emit("user-joined", { socketId: socket.id, username });

    const otherUsers = Array.from(room.entries())
      .filter(([id]) => id !== socket.id)
      .map(([id, data]) => ({ socketId: id, username: data.username }));

    socket.emit("existing-users", otherUsers);
  });

  socket.on("offer", ({ to, offer }) => {
    socket.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    socket.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  socket.on("chat-message", ({ roomId, username, message }) => {
    io.to(roomId).emit("chat-message", {
      username,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on("connection-quality", ({ roomId, quality }) => {
    const room = rooms.get(roomId);
    if (room && room.has(socket.id)) {
      room.get(socket.id).connectionQuality = quality;
      socket
        .to(roomId)
        .emit("user-quality-update", { socketId: socket.id, quality });
    }
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.has(socket.id)) {
        const userData = room.get(socket.id);
        room.delete(socket.id);
        socket
          .to(roomId)
          .emit("user-left", {
            socketId: socket.id,
            username: userData.username,
          });
        if (room.size === 0) rooms.delete(roomId);
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});
