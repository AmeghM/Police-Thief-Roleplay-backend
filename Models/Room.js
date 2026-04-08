const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  socketId: String,
  name: String,
  score: { type: Number, default: 0 },
  roundScore: { type: Number, default: 0 },
  ready: { type: Boolean, default: false },
  role: Object,
  color: String,
});

const roomSchema = mongoose.Schema({
  code: String,
  host: String,
  players: [playerSchema],
  maxPlayers: Number,
  rounds: Number,
  currentRound: Number,
  roles: Array,
  gameStarted: Boolean,
  chat: Array,
  gameChat: Array,

  createdAt: {
    type: Date,
    default: Date.now(),
    expires: 7200,
  },
});

const Room = mongoose.model("Room", roomSchema);
module.exports = Room;
