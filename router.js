const express = require("express");
const { getRoomController } = require("./Controllers/RoomController");
const router = express.Router();

router.get("/rooms", getRoomController);

module.exports = router;
