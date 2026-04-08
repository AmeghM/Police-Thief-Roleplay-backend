const { generateCode } = require("../Data/generateCode");
const Room = require("../Models/Room");
const activeRooms = {};
const gameSocket = (io, socket) => {
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // create room
  socket.on("create_room", async (data) => {
    const { username, players, rounds, roles } = data;

    const code = generateCode();

    const roomData = {
      code,
      host: socket.id,
      players: [
        {
          id: socket.id,
          name: username,
          ready: false,
          score: 0,
          roundScore: 0,
          isConnected: true,
        },
      ],
      maxPlayers: players,
      rounds,
      currentRound: 1,
      roles,
      gameStarted: false,
      chat: [],
      gameChat: [],
    };

    try {
      const newRoom = await Room.create(roomData);
      activeRooms[code] = roomData;
      socket.join(code);
      socket.emit("room_created", roomData);
      io.to(code).emit("room_update", roomData);
      console.log("Room saved in MDB");
    } catch (err) {
      console.log("Error", err);
    }
  });

  // join
  socket.on("join_room", async ({ username, roomCode }) => {
    let room = activeRooms[roomCode];

    if (!room) {
      const dbRoom = await Room.findOne({ code: roomCode });

      if (!dbRoom) {
        socket.emit("error_message", "Room not found");
        return;
      }

      activeRooms[roomCode] = dbRoom.toObject();
      room = activeRooms[roomCode];
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error_message", "Room is full");
      return;
    }

    const newPlayer = {
      id: socket.id,
      name: username,
      ready: false,
      score: 0,
      roundScore: 0,
    };

    room.players.push(newPlayer);

    await Room.updateOne({ code: roomCode }, { $push: { players: newPlayer } });

    socket.join(roomCode);

    io.to(roomCode).emit("room_update", room);
  });

  socket.on("get_room", (code) => {
    const room = activeRooms[code];

    if (room) {
      socket.emit("room_update", room);

      socket.emit("chat_update", room.chat);
    }
  });

  socket.on("toggle_ready", (code) => {
    const room = activeRooms[code];

    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    player.ready = !player.ready;

    io.to(code).emit("room_update", room);
  });

  // leave
  socket.on("leave_room", (code) => {
    const room = activeRooms[code];
    if (!room) return;

    room.players = room.players.filter((p) => p.id !== socket.id);
    socket.leave(code);

    if (room.players.lenght == 0) {
      delete activeRooms[code];
      return;
    }

    if (room.host === socket.id) {
      room.host = room.players[0]?.id;
    }
    io.to(code).emit("room_update", room);
  });

  // start

  socket.on("start_game", (code) => {
    const room = activeRooms[code];
    if (!room) return;

    if (room.host !== socket.id) return;

    const allReady = room.players.every((p) => p.ready);
    if (!allReady) return;
    room.gameStarted = true;

    // roles
    const shuffleRoles = shuffleArray([...room.roles]);
    room.players.forEach((player, index) => {
      player.role = shuffleRoles[index];

      io.to(player.id).emit("your_role", {
        role: player.role,
        round: room.currentRound,
      });
    });
    io.to(code).emit("game_started", {
      round: room.currentRound,
    });
  });

  // message
  socket.on("send_message", ({ code, message }) => {
    const room = activeRooms[code];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const msgData = {
      id: Date.now(),
      user: player.name,
      text: message,
      color: player.color,
      senderId: socket.id,
    };

    room.chat.push(msgData);

    io.to(code).emit("chat_update", room.chat);
  });

  // send game message
  socket.on("send_game_message", ({ code, message }) => {
    const room = activeRooms[code];
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    const msg = {
      id: Date.now(),
      user: player.name,
      text: message,
      senderId: socket.id,
    };

    room.gameChat.push(msg);
    io.to(code).emit("game_chat_update", room.gameChat);
  });

  // select thief
  socket.on("select_thief", ({ code, selectedId }) => {
    const room = activeRooms[code];
    if (!room) return;

    const selectedPlayer = room.players.find((p) => p.id === selectedId);
    if (!selectedPlayer) return;

    const actualThief = room.players.find((p) => p.role?.role === "Thief");

    const isCorrect = selectedPlayer.role?.role === "Thief";

    console.log("Police selected:", selectedPlayer);
    console.log("Actual thief:", actualThief?.name);

    room.players.forEach((p) => {
      p.roundScore = 0;
    });
    const police = room.players.find((p) => p.role?.role === "Police");
    const policePoints = Number(police?.role?.points) || 0;
    room.players.forEach((p) => {
      const roleName = p.role?.role;
      const rolePoints = Number(p.role?.points) || 0;

      if (roleName === "Police") {
        if (isCorrect) {
          p.score += rolePoints;
          p.roundScore = rolePoints;
        } else {
          p.roundScore = 0;
          p.score += 0;
        }
      } else if (roleName === "Thief") {
        if (!isCorrect) {
          p.score += policePoints;
          p.roundScore = policePoints;
        } else {
          p.score += 0;
          p.roundScore = 0;
        }
      } else {
        p.score += rolePoints;
        p.roundScore = rolePoints;
      }
    });

    io.to(code).emit("room_update", room);

    io.to(code).emit("reveal_result", {
      selectedId,
      actualThiefId: actualThief?.id,
      isCorrect,
      players: room.players,
    });
  });

  // rounds
  socket.on("next_round", (code) => {
    const room = activeRooms[code];
    if (!room) return;

    if (room.host !== socket.id) return;

    // next round
    room.currentRound += 1;

    if (room.currentRound > room.rounds) {
      io.to(code).emit("game_over", {
        players: room.players,
      });
      return;
    }

    // reset data
    room.gameChat = [];
    room.selectedPlayer = null;
    room.players.forEach((p) => {
      p.roundScore = 0;
    });

    // shuffle roles
    const shuffled = shuffleArray([...room.roles]);

    room.players.forEach((p, i) => {
      p.role = shuffled[i];
    });

    room.players.forEach((p) => {
      io.to(p.id).emit("your_role", {
        role: p.role,
        round: room.currentRound,
      });
    });
    io.to(code).emit("room_update", room);

    io.to(code).emit("next_round_started", {
      round: room.currentRound,
    });
  });

  // play again
  socket.on("play_again", (code) => {
    const room = activeRooms[code];
    if (!room) return;

    if (room.host !== socket.id) return;

    room.currentRound = 1;
    room.gameStarted = true;
    room.gameChat = [];
    room.chat = [];

    room.players.forEach((p) => {
      p.score = 0;
      p.roundScore = 0;
      p.ready.false;
    });

    const shuffled = shuffleArray([...room.roles]);

    room.players.forEach((p, i) => {
      p.role = shuffled[i];

      io.to(p.id).emit("your_role", {
        role: p.role,
        round: room.currentRound,
      });
    });

    io.to(code).emit("room_update", room);

    io.to(code).emit("game_restarted", {
      round: room.currentRound,
    });
  });
};

module.exports = { gameSocket };
