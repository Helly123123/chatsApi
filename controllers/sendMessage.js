const axios = require("axios");
const express = require("express");
const { pool } = require("../db"); // Импортируйте ваш pool для работы с БД
const router = express.Router();

router.post("/api/sendMessage", async (req, res) => {
  const { source, token, login, msg } = req.body;
  console.log("Получено сообщение:", msg);

  try {
    // Отправка сообщения через внешний API
    const response = await axios.post(
      "https://b2288.apitter.com/instances/sendMessage",
      { source, login, msg },
      {
        headers: {
          Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`,
        },
      }
    );

    console.log("Ответ от API:", response.data); // Логируем ответ от API

    const { status } = response.data.data;
    const results = response.data.data.results;

    if (status === "ok") {
      const unid = results[0].result.thread;
      const item = results[0].result.item;
      console.log("Статус OK, получен unid:", unid);

      // Проверка существования чата
      const query = `SELECT * FROM chats WHERE uniq = ?`;
      // *** Используем async/await напрямую с pool.query ***
      const [chatResults] = await pool.query(query, [unid]); //  Деструктуризация результата

      // console.log("Результаты запроса на существование чата:", chatResults);

      if (chatResults.length > 0) {
        console.log("ОК: Чат найден");
      } else {
        console.log("Не ОК: Чата нет! Создаю...");
      }

      // Проверка существования таблицы
      try {
        const tableCheckQuery = `SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`;
        const [tableCheckResult] = await pool.query(tableCheckQuery, [
          "chats",
          unid,
        ]);
        const tableExists = tableCheckResult[0].table_exists > 0;

        if (tableExists) {
          console.log("Таблица существует, вставляю данные...");

          const messageData = {
            to: msg.to,
            from: "79198670001", // или другое значение
            item: results[0].result.item || "3A05B1DBFE70E35181EE", // пример значения
            text: msg.text,
            time: Date.now() * 1000, // Пример времени
            source: "whatsapp",
            thread: unid,
            content: msg.content,
            replyTo: null,
            outgoing: msg.outgoing,
          };

          // Вставка данных в таблицу
          const insertChat = `INSERT INTO \`${unid}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
          try {
            const [insertResult] = await pool.query(insertChat, [
              item,
              Date.now(),
              JSON.stringify(messageData),
              "s",
            ]);
            console.log("Данные успешно вставлены:", insertResult);
          } catch (insertError) {
            console.error("Ошибка при вставке данных:", insertError);
            return res
              .status(500)
              .json({ ok: false, error: "Ошибка при вставке данных" }); //Отправляем ошибку клиенту
          }
        } else {
          console.log("Таблица не существует. Создаю таблицу...");

          // Создание таблицы
          const createTableQuery = `
          CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (
              id INT AUTO_INCREMENT PRIMARY KEY,
              uniq VARCHAR(255) NOT NULL UNIQUE,
              timestamp VARCHAR(255) NOT NULL,
              data JSON NOT NULL,
              W VARCHAR(255),
              U VARCHAR(255)
          );`;
          try {
            const [createResult] = await pool.query(createTableQuery);
            console.log("Таблица успешно создана:", createResult);
          } catch (createError) {
            console.error("Ошибка при создании таблицы:", createError);
            return res
              .status(500)
              .json({ ok: false, error: "Ошибка при создании таблицы" }); //Отправляем ошибку клиенту
          }
        }
        return res.status(200).json({ ok: true, unid: unid }); //Отправляем данные
      } catch (error) {
        console.error("Произошла ошибка:", error);
        return res
          .status(500)
          .json({ ok: false, error: "Внутренняя ошибка сервера" }); //Отправляем общую ошибку клиенту
      }
    } else {
      return res.status(400).json({ error: "Не удалось отправить сообщение." });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
