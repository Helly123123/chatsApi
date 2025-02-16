const express = require("express");
const { pool } = require("../db"); // Импортируем пул соединений с БД
const router = express.Router();

// Обработчик запроса для получения данных из указанной базы данных
router.get("/data", async (req, res) => {
  const { name } = req.query; // Получаем название таблицы из параметров запроса

  if (!name) {
    return res.status(400).json({ error: "Название таблицы не указано." });
  }

  try {
    // Используем обратные кавычки для безопасного именования таблиц
    const query = `SELECT * FROM \`${name}\``; // Формируем запрос с использованием обратных кавычек
    const [results] = await pool.query(query); // Передаем имя таблицы

    if (results.length === 0) {
      return res.status(404).json({ message: "Данные не найдены." });
    }

    // Отправляем данные обратно на фронтенд
    return res.status(200).json(results);
  } catch (error) {
    console.error("Ошибка при получении данных:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

module.exports = router;
