const express = require("express");
const { pool } = require("../db");
const router = express.Router();
const { checkDb, connectToDatabase } = require("../db");
const axios = require("axios");
const { setGlobalTableName } = require("../globals");

router.post("/api/getChats", async (req, res) => {
  const { source, token, login, unid } = req.body;

  console.log("Получен запрос /api/getChats", { source, token, login, unid });

  // Проверяем, является ли login массивом
  const logins = Array.isArray(login) ? login : [login]; // Если это не массив, преобразуем в массив
  const allChatsData = []; // Массив для хранения данных по всем логинам

  try {
    for (const currentLogin of logins) {
      if (!currentLogin || typeof currentLogin !== "string") {
        console.error(
          "Логин не передан или имеет неверный формат:",
          currentLogin
        );
        return res
          .status(400)
          .json({ error: "Логин должен быть непустой строкой." });
      }

      await connectToDatabase(source, currentLogin, "token");
      setGlobalTableName(`${source}_${currentLogin}_token`);

      const [currentDbResults] = await pool.query("SELECT * FROM chats");
      console.log("Результаты из базы данных:", currentDbResults);
      console.log("Используемый логин:", currentLogin);

      if (currentDbResults.length === 0) {
        console.log("тут ноли");
        try {
          const response = await axios.post(
            "https://b2288.apitter.com/instances/getChats",
            { source, login: currentLogin },
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

          const avatarPromises = chats.map(async (chat) => {
            const to = chat.phone;
            console.log(to);
            const userInfoResponse = await axios.post(
              "https://b2288.apitter.com/instances/getUserInfo",
              { source, login: currentLogin, to },
              {
                headers: {
                  Authorization: `Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5`,
                },
              }
            );

            if (userInfoResponse.data.ok) {
              return {
                ...chat,
                avatar: userInfoResponse.data.data.pictureUrl,
                loginUser: currentLogin,
              };
            } else {
              console.error(
                "Ошибка при получении информации о пользователе:",
                userInfoResponse.data
              );
              return { ...chat, avatar: null, loginUser: currentLogin };
            }
          });

          const chatsWithAvatars = await Promise.all(avatarPromises);

          const insertChats =
            "INSERT INTO chats (uniq, timestamp, newMessage, data, w) VALUES (?,?,?,?,?)";
          for (const chat of chatsWithAvatars) {
            const unid = chat.lastMessage ? chat.lastMessage.id.remote : null; // Проверка на существование lastMessage
            const timestamp = chat.timestamp;
            const newMessage = chat.unreadCount;
            const data = JSON.stringify(chat);

            if (unid) {
              // Проверяем, что unid существует, прежде чем выполнять запрос
              await pool.query(insertChats, [
                unid,
                timestamp,
                newMessage,
                data,
                "c",
              ]);
            } else {
              console.warn("У чата отсутствует lastMessage, пропускаем:", chat);
            }
          }

          // Заменяем вызов checkDb на запрос к базе данных
          const [currentDbResults] = await pool.query("SELECT * FROM chats");

          const responseData = currentDbResults.map((item) => {
            const dataParse = item.data;
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

          allChatsData.push(...responseData); // Добавляем данные текущего логина в общий массив
        } catch (apiError) {
          console.error("Ошибка при запросе к API:", apiError.message);
          return res.status(500).json({ error: "Ошибка при запросе к API." });
        }
      } else {
        // Если чаты уже существуют в базе
        for (const chat of currentDbResults) {
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

        const responseData = currentDbResults.map((item) => {
          const dataParse = item.data; // Если data уже в нужном формате
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

        allChatsData.push(...responseData); // Добавляем данные текущего логина в общий массив
      }
    }

    // После обработки всех логинов, отправляем ответ
    return res.status(200).json({
      message: "Данные чатов успешно получены.",
      data: {
        chats: allChatsData,
      },
    });
  } catch (error) {
    console.error("Произошла общая ошибка:", error.message);
    return res.status(500).json({ error: "Внутренняя ошибка сервера." });
  }
});

module.exports = router;
