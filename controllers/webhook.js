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
  } else {
    console.log("Тип хука не поддерживается, выходим.");
  }

  return res.status(200).send("OK");
};

const handleMessageHook = async (body, thread, item, time, to) => {
  const unid = thread; // Используем thread как уникальный идентификатор чата
  const chatCheckQuery = `SELECT * FROM chats WHERE uniq = ?`;

  try {
    // Проверяем, существует ли чат в таблице chats
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

    // Обработка существующего чата
    if (chatExists.length > 0) {
      console.log(`Чат ${unid} существует. Проверяем существование таблицы...`);
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

const handleExistingChat = async (unid, messageData, chatsData, time) => {
  const insertChatQuery = `
  INSERT INTO chats (uniq, timestamp, data, w)
  VALUES (?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE
  timestamp = ?, data = ?, w = ?`;

  await pool.query(insertChatQuery, [
    unid, // 1. uniq
    time, // 2. timestamp
    JSON.stringify(chatsData), // 3. data
    "c", // 4. w
    time, // 5. timestamp (для обновления)
    JSON.stringify(chatsData), // 6. data (для обновления)
    "c", // 7. w (для обновления)
  ]);
  console.log("Данные чата успешно вставлены или обновлены.");

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
      w VARCHAR(255),
      u VARCHAR(255)
    );`;
  await pool.query(createTableQuery);
  console.log(`Таблица ${unid} была создана.`);

  // Вставляем сообщение в таблицу
  const insertMessage = `INSERT INTO \`${unid}\` (uniq, timestamp, data, w) VALUES (?, ?, ?, ?)`;
  await pool.query(insertMessage, [
    messageData.item,
    messageData.time,
    JSON.stringify(messageData),
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

  // Логируем статус сообщения
  console.log(
    "Получен статус сообщения:",
    JSON.stringify(statusMessage, null, 2)
  );

  sendSSE(statusMessage);
};

const handleMessageSendStatusHook = async (body) => {
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

    // Отправляем данные через SSE
    sendSSE(message);
  } else {
    console.log("Тип хука не соответствует 'message', игнорируем.");
  }
};

// Экспортируем функцию вебхука
module.exports = webhook;
