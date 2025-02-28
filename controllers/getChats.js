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

        // Создаем массив промисов для получения аватарок
        const avatarPromises = chats.map(async (chat) => {
          const to = chat.phone; // Предполагаем, что номер телефона находится в объекте чата
          console.log(to);
          const userInfoResponse = await axios.post(
            "https://b2288.apitter.com/instances/getUserInfo",
            { source, login, to },
            {
              headers: {
                Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`,
              },
            }
          );

          // Проверяем, получили ли мы данные о пользователе
          if (userInfoResponse.data.ok) {
            console.log(userInfoResponse.data.data.pictureUrl);
            return {
              ...chat,
              avatar: userInfoResponse.data.data.pictureUrl, // Предполагаем, что аватарка находится в этом поле
            };
          } else {
            console.error(
              "Ошибка при получении информации о пользователе:",
              userInfoResponse.data
            );
            return { ...chat, avatar: null }; // Если не удалось получить аватар, возвращаем null
          }
        });

        // Ждем завершения всех промисов
        const chatsWithAvatars = await Promise.all(avatarPromises);

        const insertChats =
          "INSERT INTO chats (uniq, timestamp, newMessage, data, w) VALUES (?,?,?,?,?)";
        for (const chat of chatsWithAvatars) {
          const unid = chat.lastMessage.id.remote;
          const timestamp = chat.timestamp;
          const newMessage = chat.unreadCount;
          const data = JSON.stringify(chat);
          await pool.query(insertChats, [
            unid,
            timestamp,
            newMessage,
            data,
            "c",
          ]);
        }

        // Запрос к базе данных для получения данных по unid
        const dbResults = await checkDb("getChats", unid);

        const responseData = dbResults.map((item) => {
          const dataParse = JSON.parse(item.data);
          // const dataParse = item.data;
          return {
            id: item.id,
            newMessage: item.newMessage,
            timestamp: item.timestamp,
            u: item.u,
            uniq: item.uniq,
            w: item.w,
            data: dataParse,
          };
        });

        return res.status(200).json({
          message: "Чаты уже существуют.",
          data: {
            chats: responseData,
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

      const responseData = results.map((item) => {
        // const dataParse = item.data;
        const dataParse = JSON.parse(item.data);
        // const parseData = JSON.parse(dataParse);
        const parseData = dataParse;
        return {
          id: item.id,
          newMessage: item.newMessage,
          timestamp: item.timestamp,
          u: item.u,
          uniq: item.uniq,
          w: item.w,
          data: parseData,
        };
      });

      return res.status(200).json({
        message: "Чаты уже существуют.",
        data: {
          chats: responseData,
        },
      });
    }
  } catch (error) {
    console.error("Произошла общая ошибка:", error.message);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
