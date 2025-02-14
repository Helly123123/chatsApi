const express = require("express");
const router = express.Router();
const getChats = require("../controllers/getChats");
const sendMessage = require("../controllers/sendMessage");
const getChatMessages = require("../controllers/getChatsMessages");
const webhook = require("../controllers/webhook");

// Определяем маршруты
router.post("/api/webhook", webhook);

module.exports = router;
