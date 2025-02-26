const axios = require("axios");
const { pool } = require("../db"); // Импортируйте ваш pool для работы с БД
const express = require("express");
const router = express.Router();

router.post("/api/getChatMessages", async (req, res) => {
  const { source, token, login, to, uniq } = req.body;
  console.log("Получен uniq:", uniq); // Логируем полученный идентификатор чата

  try {
    // Проверяем, существует ли таблица для чатов
    const [results] = await pool.query(
      "SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      ["chats", uniq]
    );

    console.log("Существование таблицы:", results[0].table_exists);

    // Если таблица не существует, получаем сообщения из API
    if (results[0].table_exists === 0) {
      console.log("Получение сообщений из API...");

      const response = await axios.post(
        "https://b2288.apitter.com/instances/getChatMessages",
        { source, login, to },
        {
          headers: {
            Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`,
          },
        }
      );

      console.log("Ответ от API:", response.data);

      // Проверяем статус ответа
      if (response.status === 401) {
        return res
          .status(401)
          .json({ errorMessage: "Unauthorized", ok: false });
      }

      // Проверяем формат данных
      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data.messages)
      ) {
        console.error("Неверный формат данных:", response.data);
        return res
          .status(500)
          .json({ error: "Неверный формат данных сообщений." });
      }

      const messages = response.data.data.messages;
      const sanitizedTableName = response.data.data.chat.id?._serialized;

      console.log("Создаваемая таблица:", sanitizedTableName);

      // Создаём таблицу для сообщений
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uniq VARCHAR(255) NOT NULL UNIQUE,
        timestamp VARCHAR(255) NOT NULL,
        data JSON NOT NULL,
        w VARCHAR(255),
        u VARCHAR(255),
        state TINYINT(1) DEFAULT 0,  
        reaction VARCHAR(255) DEFAULT NULL
);`;

      await pool.query(createTableQuery);
      console.log(
        `Таблица '${sanitizedTableName}' успешно создана или уже существует.`
      );

      const insertChat = `INSERT INTO \`${sanitizedTableName}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?) 
                    ON DUPLICATE KEY UPDATE 
                    timestamp = VALUES(timestamp), 
                    data = VALUES(data), 
                    w = CASE 
                          WHEN w IS NULL THEN 'm' 
                          ELSE CONCAT(w, ',', 'm') 
                        END`;

      for (const message of messages) {
        const unid = message.item; // Уникальный идентификатор сообщения
        const data = JSON.stringify({
          ...message,
          state: false,
          reaction: "",
          send: "",
        });
        const timestamp = message.time;

        // Выполняем вставку или обновление
        await pool.query(insertChat, [unid, timestamp, data, "m"]);
      }

      // Извлекаем сообщения из БД
      const query = `SELECT * FROM \`${sanitizedTableName}\` ORDER BY timestamp DESC`;
      const [messagesFromDb] = await pool.query(query);
      console.log("Сообщения из БД:", messagesFromDb);

      // Изменяем порядок сообщений на обратный
      const reversedMessages = messagesFromDb
        .reverse()
        .map((message) => message.data); // Парсим данные

      // Отправляем ответ в формате JSON
      return res.status(200).json({
        ok: true,
        data: {
          messages: reversedMessages, // Отправляем сообщения в обратном порядке
        },
      });
    } else {
      console.log("Таблица уже существует, извлечение сообщений...");

      // Обновляем поле 'w' таблицы, добавляя "m"

      // Получаем сообщения из API
      // Получаем сообщения из API
      const response = await axios.post(
        "https://b2288.apitter.com/instances/getChatMessages",
        { source, login, to },
        {
          headers: {
            Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`, // Заголовок авторизации
          },
        }
      );

      // Проверяем статус ответа
      if (response.status === 401) {
        return res
          .status(401)
          .json({ errorMessage: "Unauthorized", ok: false });
      }

      // Проверяем формат данных
      if (
        !response.data ||
        !response.data.data ||
        !Array.isArray(response.data.data.messages)
      ) {
        console.error("Неверный формат данных:", response.data);
        return res
          .status(500)
          .json({ error: "Неверный формат данных сообщений." });
      }

      const sanitizedTableName = response.data.data.chat.id?._serialized;
      console.log(
        "Имя таблицы для существующих сообщений:",
        sanitizedTableName
      );

      // Получаем сообщения из БД
      const query = `SELECT * FROM \`${sanitizedTableName}\` ORDER BY timestamp DESC`;
      const [messagesFromDb] = await pool.query(query);
      console.log("Сообщения из БД:", messagesFromDb);

      // Изменяем порядок сообщений на обратный
      const reversedMessages = messagesFromDb
        .reverse()
        .map((message) => message.data); // Парсим данные

      // Отправляем ответ в формате JSON
      return res.status(200).json({
        ok: true,
        data: {
          messages: reversedMessages, // Отправляем сообщения в обратном порядке
        },
      });
    }
  } catch (error) {
    console.error("Ошибка при обработке запроса:", error);
    return res
      .status(500)
      .json({ error: "Произошла ошибка при обработке запроса." });
  }
});

module.exports = router;
