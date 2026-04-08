require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const router = require("./router");
const { gameSocket } = require("./gameSockets/gameSocket");
require("./connection");

const gameServer = express();
gameServer.use(cors());
gameServer.use(express.json());

const server = http.createServer(gameServer);

const PORT = 3000;

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  gameSocket(io, socket);
});

server.listen(PORT, () => {
  console.log(`Game server starter running at ${PORT}`);
});

gameServer.get("/", (req, res) => {
  res.status(200).send("Game server started running successfully.");
});
