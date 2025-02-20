const express = require("express");
const router = express.Router();
const { addClient, removeClient } = require("./sse");
const webhook = require("../controllers/webhook");
// Обработчик для SSE
router.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Добавляем клиента
  addClient(res);

  // Удаляем клиента, когда соединение закрыто
  req.on("close", () => {
    removeClient(res);
  });
});

// Определяем маршруты
router.post("/api/webhook", webhook);

module.exports = router;
