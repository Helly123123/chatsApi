const express = require("express");
const { pool } = require("../db"); // Импортируйте ваш pool для работы с БД
const router = express.Router();

// Новый маршрут для получения всех чатов
router.get("/api/getAllChats", async (req, res) => {
  console.log("Получен запрос /api/getAllChats"); // ЛОГ 1: Подтверждение получения запроса

  try {
    const query = "SELECT * FROM chats"; // SQL запрос для получения всех записей из таблицы chats
    console.log("Выполняем запрос к базе данных..."); // ЛОГ 2: Перед выполнением запроса

    // Используем pool.query напрямую, так как он уже возвращает промис
    const [results] = await pool.query(query);

    console.log("Получены данные из базы данных:", results); // ЛОГ 3: Полученные данные

    return res.status(200).json({
      message: "Данные чатов успешно получены.",
      data: results, // Отправляем все данные чатов
    });
  } catch (error) {
    console.error("Произошла ошибка при получении данных:", error.message);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
