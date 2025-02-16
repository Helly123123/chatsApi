const express = require("express");
const { pool } = require("../db");
const axios = require("axios"); // Импортируем axios для выполнения HTTP-запросов

const webhook = async (req, res) => {
  const { body } = req;

  // Логирование полученного вебхука
  console.log("Получен вебхук:", JSON.stringify(body, null, 2));

  const {
    from,
    to,
    time,
    text,
    thread,
    item,
    outgoing,
    replyTo,
    content,
    hook_type,
  } = body;

  // Проверка типа хука
  if (hook_type !== "message") {
    console.log("Тип хука не message, выходим.");
    return res.status(200).send("OK");
  }

  const unid = thread; // Используем thread как уникальный идентификатор чата
  const chatCheckQuery = `SELECT * FROM chats WHERE uniq = ?`;

  try {
    // Проверяем, существует ли чат в таблице chats
    const [chatExists] = await pool.query(chatCheckQuery, [unid]);
    console.log("Результат проверки существования чата:", chatExists);

    const messageData = {
      to,
      from,
      item: item || "3A05B1DBFE70E35181EE",
      text,
      time,
      source: "whatsapp",
      thread: unid,
      content,
      replyTo,
      outgoing,
      w: "h", // Добавляем значение 'h' в поле 'w'
    };

    if (chatExists.length > 0) {
      // Если чат существует, обновляем сообщение
      console.log(`Чат ${unid} существует. Вставляем данные...`);
      const insertMessage = `INSERT INTO \`${unid}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
      console.log(`Вставка данных в таблицу ${unid}:`, messageData);
      await pool.query(insertMessage, [
        item,
        time,
        JSON.stringify(messageData),
        messageData.w,
      ]);
      console.log("Данные сообщения успешно вставлены.");

      // Обновляем поле 'u' в таблице chats
      const updateChatFieldU = `UPDATE chats SET u = ? WHERE uniq = ?`;
      await pool.query(updateChatFieldU, ["h", unid]);
      console.log("Поле 'u' успешно обновлено на 'h' для чата:", unid);
    } else {
      // Если чата нет, создаем новый чат с данными из вебхука
      console.log(`Чат ${unid} не существует. Создаем новый чат...`);
      const newChatData = {
        uniq: unid,
        timestamp: time,
        data: JSON.stringify(messageData), // Создаем новый чат с данными из вебхука
        w: "h", // Устанавливаем 'h' в поле 'w'
      };

      // Вставляем новый чат в таблицу
      const insertChat = `INSERT INTO chats (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
      await pool.query(insertChat, [
        newChatData.uniq,
        newChatData.timestamp,
        newChatData.data,
        newChatData.w,
      ]);
      console.log("Новый чат успешно добавлен с данными из вебхука.");

      // Теперь делаем запрос к API для получения дополнительной информации
      console.log(`Запрашиваем информацию о пользователе...`);
      const apiUrl = "https://b2288.apitter.com/instances/getUserInfo";
      const apiHeaders = {
        Authorization: "Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5",
      };
      const apiBody = {
        source: "whatsapp",
        login: "helly",
        to, // Используем переменную `to` из вебхука
      };

      try {
        const response = await axios.post(apiUrl, apiBody, {
          headers: apiHeaders,
        });
        console.log("Ответ от API:", response.data);

        // Если API возвращает данные, обновляем информацию о чате
        if (response.data.ok === true) {
          const userInfo = response.data.data;

          // Полностью заменяем данные чата на данные из API
          const updatedChatData = {
            uniq: unid,
            timestamp: time,
            data: JSON.stringify({
              ...messageData,
              userInfo, // Вставляем информацию о пользователе
            }),
          };

          // Обновляем данные чата в таблице
          const updateChat = `UPDATE chats SET timestamp = ?, data = ?, u = ? WHERE uniq = ?`;
          await pool.query(updateChat, [
            updatedChatData.timestamp,
            updatedChatData.data,
            "h", // Устанавливаем 'h' в поле 'u'
            updatedChatData.uniq,
          ]);
          console.log("Данные чата успешно обновлены с информацией из API.");
        } else {
          console.log("Ошибка при получении данных от API:", response.data);
          return res
            .status(400)
            .json({ error: "Не удалось получить данные о пользователе." });
        }
      } catch (apiError) {
        console.error("Ошибка при запросе к API:", apiError);
        return res
          .status(500)
          .json({ error: "Ошибка при получении информации о пользователе" });
      }
    }

    return res.status(200).json({ message: "Вебхук получен и обработан." });
  } catch (error) {
    console.error("Ошибка при обработке вебхука:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

module.exports = webhook;
