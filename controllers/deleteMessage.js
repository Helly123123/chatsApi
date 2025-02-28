const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// Маршрут для очистки новых сообщений
router.post("/api/delete-messages", async (req, res) => {
  const { uniq, item } = req.body; // Получаем uniq и item из тела запроса

  console.log("Полученные данные:", { uniq, item });

  if (!uniq || !item) {
    return res.status(400).json({ message: "Необходимо указать uniq и item." });
  }

  try {
    // Обновляем поле `delete` для указанного uniq
    const result = await pool.query(
      `UPDATE \`${uniq}\` SET \`delete\` = true WHERE uniq = ?`,
      [item]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Сообщение не найдено." });
    }

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
