const express = require("express");
const { pool } = require("../db");

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

  const unid = thread; // Используем thread как уникальный идентификатор таблицы
  const tableCheckQuery = `SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`;

  try {
    // Проверяем, существует ли таблица
    const [tableExists] = await pool.query(tableCheckQuery, ["chats", unid]);
    console.log("Результат проверки существования таблицы:", tableExists);

    if (tableExists[0].table_exists > 0) {
      console.log(`Таблица ${unid} существует. Вставляем данные...`);
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
      };

      const insertChat = `INSERT INTO \`${unid}\` (uniq, timestamp, data) VALUES (?, ?, ?)`;
      console.log(`Вставка данных в таблицу ${unid}:`, messageData);
      await pool.query(insertChat, [item, time, JSON.stringify(messageData)]);
      console.log("Данные успешно вставлены.");
    } else {
      console.log(`Таблица ${unid} не существует. Создаю таблицу...`);
      const createTableQuery = `
          CREATE TABLE IF NOT EXISTS \`${unid}\` (
            id INT AUTO_INCREMENT PRIMARY KEY,
            uniq VARCHAR(255) NOT NULL,
            timestamp VARCHAR(255) NOT NULL,
            data JSON NOT NULL
          );`;
      await pool.query(createTableQuery);
      console.log("Таблица успешно создана.");
    }

    return res.status(200).json({ message: "Вебхук получен и обработан." });
  } catch (error) {
    console.error("Ошибка при обработке вебхука:", error);
    return res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
};

module.exports = webhook;
