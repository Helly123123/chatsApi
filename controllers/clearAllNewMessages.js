const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// Маршрут для очистки новых сообщений
router.post("/api/clear-new-messages", async (req, res) => {
  const { uniq } = req.body; // Получаем uniq из тела запроса

  if (!uniq) {
    return res.status(400).json({ message: "Необходимо указать uniq." });
  }

  try {
    // Обновляем поле newMessage на 0 для указанного uniq
    await pool.query(`UPDATE chats SET newMessage = 0 WHERE uniq = ?`, [uniq]);

    return res
      .status(200)
      .json({ message: "Новые сообщения успешно очищены." });
  } catch (error) {
    console.error("Ошибка при очистке новых сообщений:", error);
    return res
      .status(500)
      .json({ message: "Ошибка сервера при очистке новых сообщений." });
  }
});

module.exports = router;
