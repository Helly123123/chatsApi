const express = require("express");
const { pool } = require("../db");
const axios = require("axios"); // Импортируем axios для выполнения HTTP-запросов
const app = express();
app.use(express.json());

const { sendSSE } = require("../routes/sse");

// Функция для отправки сообщений клиентам SSE

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
  if (hook_type === "message") {
    await handleMessageSendStatusHook(body);
    await handleMessageHook(body, thread, item, time, to);
  } else if (hook_type === "message_status") {
    await handleMessageStatusHook(body);
  } else if (hook_type === "add_message_reaction") {
    await handleAddReactionHook(body);
  } else {
    console.log("Тип хука не поддерживается, выходим.");
  }

  return res.status(200).send("OK");
};

const handleMessageHook = async (body, thread, item, time, to) => {
  const unid = thread; // Используем thread как уникальный идентификатор чата
  const chatCheckQuery = `SELECT * FROM chats WHERE uniq = ?`;

  try {
    const [chatExists] = await pool.query(chatCheckQuery, [unid]);
    console.log("Результат проверки существования чата:", chatExists);
    console.log("а");
    const messageData = {
      to,
      from: body.from,
      item: item || "3A05B1DBFE70E35181EE",
      text: body.text,
      time,
      source: "whatsapp",
      thread: unid,
      content: body.content,
      outgoing: body.outgoing,
      w: "h", // Добавляем значение 'h' в поле 'w'
    };

    const chatsData = {
      phone: to,
      timestamp: time,
    };

    if (chatExists.length > 0) {
      console.log(`Чат ${unid} существует. Проверяем существование таблицы...`);
      await getChatDataAndUpdate(unid, time, messageData.text);
      await handleExistingChat(unid, messageData, chatsData, time);
    } else {
      console.log(`Чат ${unid} не существует. Создаем новый чат...`);
      await handleNewChat(unid, messageData, chatsData, time);
    }
  } catch (error) {
    console.error("Ошибка при обработке хука сообщения:", error);
    throw error; // Пробрасываем ошибку для обработки в основном блоке
  }
};

async function getChatDataAndUpdate(uniq, timestamp, message) {
  try {
    // Выполняем SQL-запрос для поиска данных по uniq
    const [rows] = await pool.query("SELECT data FROM chats WHERE uniq = ?", [
      uniq,
    ]);
    const timestampInSeconds = Math.floor(timestamp / 10000);
    if (rows.length > 0) {
      console.log(rows);
      let dataParse = rows[0].data.replace(/^"|"$/g, "").replace(/\\/g, "");
      let data = JSON.parse(dataParse);
      console.log(data.lastMessage);
      // Обновляем lastMessage.body и timestamp
      data.lastMessage.body = message;
      data.timestamp = timestampInSeconds;
      ы;

      const updatedData = JSON.stringify(data);

      await pool.query("UPDATE chats SET data = ? WHERE uniq = ?", [
        updatedData,
        uniq,
      ]);

      // Возвращаем обновленный объект data
      return data;
    } else {
      console.log(`Чат с uniq ${uniq} не найден.`);
      return null; // Возвращаем null, если чат не найден
    }
  } catch (error) {
    console.error("Ошибка при получении и обновлении данных чата:", error);
    throw error; // Пробрасываем ошибку дальше
  }
}

async function changeMessageStatus(uniq, thread, content, item) {
  try {
    console.log(item, thread);
    const [rows] = await pool.query(
      `SELECT data FROM \`${thread}\`WHERE uniq = ?`,
      [item]
    );

    if (rows.length > 0) {
      console.log(rows);
      let dataParse = rows[0].data.replace(/^"|"$/g, "").replace(/\\/g, "");
      let data = JSON.parse(dataParse);
      data.state = content[0].type;

      const updatedData = JSON.stringify(data);
      console.log(updatedData);
      await pool.query(`UPDATE \`${thread}\` SET data = ? WHERE uniq = ?`, [
        updatedData,
        uniq,
      ]);
    } else {
      console.log(`Чат с uniq ${uniq} не найден.`);
      return null; // Возвращаем null, если чат не найден
    }
  } catch (error) {
    console.error("Ошибка при получении и обновлении данных чата:", error);
    throw error; // Пробрасываем ошибку дальше
  }
}

const handleExistingChat = async (unid, messageData, chatsData, time) => {
  const tableCheckQuery = `
    SELECT COUNT(*) AS table_exists
    FROM information_schema.tables
    WHERE table_schema = ? AND table_name = ?`;
  const [tableExists] = await pool.query(tableCheckQuery, ["chats", unid]);

  if (tableExists[0].table_exists > 0) {
    console.log(`Таблица ${unid} существует. Обновляем данные...`);

    // Сначала получаем текущее значение newMessage
    const getCurrentNewMessage = `SELECT newMessage FROM chats WHERE uniq = ?`;
    const [currentMessageRows] = await pool.query(getCurrentNewMessage, [
      messageData.item,
    ]);

    let newMessageCount = 0;

    // Если запись существует, увеличиваем newMessage
    if (currentMessageRows.length > 0) {
      newMessageCount = currentMessageRows[0].newMessage + 1; // Увеличиваем на 1
    } else {
      // Если записи нет, начинаем с 1
      newMessageCount = 1;
    }

    // Обновляем или вставляем данные
    const insertOrUpdateMessage = `INSERT INTO \`${unid}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
    await pool.query(insertOrUpdateMessage, [
      messageData.item,
      time,
      JSON.stringify(messageData),
      messageData.w,
    ]);

    console.log("Данные сообщения успешно обновлены или вставлены.");

    // Обновляем поле 'u' в таблице chats
    const updateChatFieldU = `UPDATE chats SET u = ? WHERE uniq = ?`;
    await pool.query(updateChatFieldU, ["h", unid]);
    console.log("Поле 'u' успешно обновлено на 'h' для чата:", unid);
  } else {
    await createChatTableAndInsert(unid, messageData);
  }
};

const handleNewChat = async (unid, messageData, chatsData, time) => {
  const tableCheckQuery = `
    SELECT COUNT(*) AS table_exists
    FROM information_schema.tables
    WHERE table_schema = ? AND table_name = ?`;
  const [tableExists] = await pool.query(tableCheckQuery, ["chats", unid]);

  if (tableExists[0].table_exists > 0) {
    console.log(`Таблица ${unid} существует. Вставляем данные...`);
    const insertMessage = `INSERT INTO \`${unid}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
    await pool.query(insertMessage, [
      messageData.item,
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
    await createChatTableAndInsert(unid, messageData);
  }
};

const createChatTableAndInsert = async (unid, messageData) => {
  console.log(`Таблица ${unid} не существует. Создаем новую таблицу...`);
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS \`${unid}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uniq VARCHAR(255) NOT NULL UNIQUE,
      timestamp VARCHAR(255) NOT NULL,
      data JSON NOT NULL,
      replyTo VARCHAR(255),
      w VARCHAR(255),
      u VARCHAR(255),
    \`delete\` BOOLEAN DEFAULT FALSE
    );`;
  await pool.query(createTableQuery);
  console.log(`Таблица ${unid} была создана.`);

  // Вставляем сообщение в таблицу
  const insertMessage = `INSERT INTO \`${unid}\` (uniq, timestamp, data, replyTo, w) VALUES (?, ?, ?, ?)`;
  await pool.query(insertMessage, [
    messageData.item,
    messageData.time,
    JSON.stringify(messageData),
    messageData.replyTo,
    messageData.w,
  ]);
  console.log("Данные сообщения успешно вставлены.");
};

const handleMessageStatusHook = async (body) => {
  const { thread, status, time, hook_type, content, item } = body;

  // Создаем объект сообщения со статусом
  const statusMessage = {
    thread,
    status,
    time,
    item,
    hook_type,
    content,
  };

  if (hook_type === "message_status") {
    changeMessageStatus(item, thread, content, item);
  }

  console.log(
    "Получен статус сообщения:",
    JSON.stringify(statusMessage, null, 2)
  );

  sendSSE(statusMessage);
};

const handleAddReactionHook = async (body) => {
  const {
    from,
    to,
    thread,
    text,
    outgoing,
    replyTo,
    time,
    hook_type,
    content,
    item,
  } = body;

  // Проверяем, что тип хука - это сообщение
  if (hook_type === "add_message_reaction") {
    const message = {
      from,
      to,
      time,
      text,
      thread,
      outgoing,
      replyTo,
      content,
      hook_type,
      item,
    };

    // Логируем статус сообщения
    console.log("Получено сообщение:", JSON.stringify(message, null, 2));
    sendSSE(message);

    // Извлекаем реакцию из content
    const reaction = content[0].src;
    console.log(reaction);

    try {
      // Обновляем поле reaction в таблице
      const [result] = await pool.execute(
        `UPDATE \`${thread}\` SET reaction = ? WHERE uniq = ?`,
        [reaction, replyTo]
      );

      console.log(
        `Обновлено ${result.affectedRows} запись(ей) для item: ${item}`
      );
    } catch (error) {
      console.error("Ошибка при обновлении реакции:", error);
    }
  } else {
    console.log("Тип хука не соответствует 'message', игнорируем.");
  }
};

const handleMessageSendStatusHook = async (body) => {
  // await connectToDatabase(source, login, "token");
  // await setGlobalTableName(`${source}_${login}_token`);
  const {
    from,
    to,
    thread,
    text,
    outgoing,
    replyTo,
    time,
    hook_type,
    content,
    item,
  } = body;

  // Проверяем, что тип хука - это сообщение
  if (hook_type === "message") {
    const message = {
      from,
      to,
      time,
      text,
      thread,
      outgoing,
      replyTo,
      content,
      hook_type,
      item,
    };

    // Логируем статус сообщения
    console.log("Получено сообщение:", JSON.stringify(message, null, 2));

    const checkIfChatExists = (thread) => {
      return new Promise((resolve, reject) => {
        const query = "SELECT * FROM chats WHERE uniq = ?";
        pool.query(query, [thread], (error, results) => {
          if (error) {
            return reject(error);
          }
          resolve(results.length > 0); // Возвращаем true, если запись найдена
        });
      });
    };
    checkIfChatExists(thread)
      .then((exists) => {
        if (exists) {
          console.log(`Чат с thread ${thread} существует.`);
        } else {
          console.log(`Чат с thread ${thread} не найден.`);
        }
      })
      .catch((error) => {
        console.error("Ошибка при проверке чата:", error);
      });
    sendSSE(message);
  } else {
    console.log("Тип хука не соответствует 'message', игнорируем.");
  }
};

// Экспортируем функцию вебхука
module.exports = webhook;
