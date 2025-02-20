const express = require("express");
const { pool } = require("../db");
const router = express.Router();
const { checkDb } = require("../db");
const axios = require("axios");

router.post("/api/getChats", async (req, res) => {
  const { source, token, login, unid } = req.body;

  console.log("Получен запрос /api/getChats", { source, token, login, unid });

  try {
    const results = await checkDb("getChats", unid);

    if (results.length === 0) {
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

        const chats = response.data.data.chats;

        if (!Array.isArray(chats)) {
          console.log(response.data);
          return res
            .status(500)
            .json({ error: "Данные чатов не являются массивом." });
        }

        const insertChats =
          "INSERT INTO chats (uniq, timestamp, data, w) VALUES (?,?,?,?)";
        for (const chat of chats) {
          const unid = chat.lastMessage.id.remote;
          const timestamp = chat.timestamp;
          const data = JSON.stringify(chat);
          await pool.query(insertChats, [unid, timestamp, data, "c"]);
        }

        return res.status(200).json({
          message: "Чаты успешно добавлены.",
          data: {
            chats: chats.map((chat) => JSON.stringify(chat)), // Преобразование данных
          },
        });
      } catch (apiError) {
        console.error("Ошибка при запросе к API:", apiError.message);
        return res.status(500).json({ error: "Ошибка при запросе к API." });
      }
    } else {
      for (const chat of results) {
        const chatId = chat.uniq;
        const updateWQuery = `
          UPDATE chats
          SET w = CASE
            WHEN w IS NULL THEN 'c'
            ELSE CONCAT(w, ',', 'c')
          END
          WHERE uniq = ?;
        `;
        await pool.query(updateWQuery, [chatId]);
      }

      return res.status(200).json({
        message: "Чаты уже существуют.",
        data: {
          chats: results.map((chat) => chat.data), // Преобразование данных из базы
        },
      });
    }
  } catch (error) {
    console.error("Произошла общая ошибка:", error.message);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
