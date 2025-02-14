const axios = require("axios");
const express = require("express");
const { pool } = require("../db"); // Импортируйте ваш pool для работы с БД
const router = express.Router();
const { checkDb } = require("../db"); // Импортируем функции

router.post("/api/getChats", async (req, res) => {
  const { source, token, login, unid } = req.body;

  console.log("Получен запрос /api/getChats", { source, token, login, unid }); // ЛОГ 1: Подтверждение получения запроса

  try {
    console.log("Вызываем checkDb..."); // ЛОГ 2: Перед вызовом checkDb
    const results = await checkDb("getChats", unid);

    console.log("Результат checkDb:", results); // ЛОГ 3: Результат работы checkDb

    if (results.length === 0) {
      console.log("Чаты не найдены, делаем запрос к API..."); // ЛОГ 4: Чаты не найдены

      try {
        const response = await axios.post(
          "https://b2288.apitter.com/instances/getChats",
          { source, login },
          {
            headers: {
              Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`,
            },
          }
        );

        console.log("Ответ от API:", response.data); // ЛОГ 5: Ответ от API

        const chats = response.data.data.chats;

        if (!Array.isArray(chats)) {
          console.error("Данные чатов не являются массивом:", chats); // ЛОГ 6: Ошибка, если данные не массив
          return res
            .status(500)
            .json({ error: "Данные чатов не являются массивом." });
        }

        console.log("Подготовка данных для вставки..."); // ЛОГ 7: Перед подготовкой данных

        const insertChats =
          "INSERT INTO chats (uniq, timestamp, data) VALUES ?";

        const values = chats.map((chat) => [
          chat.lastMessage.id.remote, // уникальный идентификатор
          chat.timestamp,
          JSON.stringify(chat),
        ]);

        console.log("Данные для вставки:", values); // ЛОГ 8: Данные для вставки

        try {
          console.log("Выполняем вставку данных..."); // ЛОГ 9: Перед вставкой
          await new Promise((resolve, reject) => {
            pool.query(insertChats, [values], (err) => {
              if (err) {
                console.error("Ошибка при пакетной вставке чатов:", err);
                return reject(err);
              }
              resolve();
            });
          });

          console.log("Вставка данных завершена. Отправляем ответ клиенту..."); // ЛОГ 10: После вставки

          return res.status(200).json({
            message: "Чаты успешно добавлены.",
            data: {
              chats: response.data,
            }, // Отправляем данные, полученные от API
          });
        } catch (error) {
          console.log("Не удалось вставить чаты. Ошибка:", error.message);
          return res.status(500).json({ error: "Ошибка при вставке чатов." }); // Отправляем ошибку
        }
      } catch (apiError) {
        console.error("Ошибка при запросе к API:", apiError.message);
        return res.status(500).json({ error: "Ошибка при запросе к API." }); // Отправляем ошибку
      }
    } else {
      console.log("Чаты найдены в базе данных:", results); // ЛОГ 11: Чаты найдены
      console.log("Чаты найдены в базе данных:", results); // ЛОГ 11: Чаты найдены
      return res.status(200).json({
        message: "Чаты уже существуют.",
        data: {
          chats: results.map((chat) => chat.data), // Извлекаем только поле data из каждого объекта
        },
      });
    }
  } catch (error) {
    console.log("Произошла общая ошибка:", error.message);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
