const express = require("express");
const axios = require("axios");
const mysql = require("mysql2/promise");
const cors = require("cors");

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
  database: process.env.MYSQL_DATABASE || "your_database_name",
};

const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
});

// Проверка и создание базы данных
const checkAndCreateDatabase = async () => {
  const connect = await pool.getConnection();
  try {
    console.log("Проверяем существование базы данных...");

    const [databaseCheckResult] = await connect.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbConfig.database]
    );

    if (databaseCheckResult.length === 0) {
      console.log(
        `База данных '${dbConfig.database}' не существует, создаем...`
      );
      await connect.query(`CREATE DATABASE ${dbConfig.database}`);
      console.log(`База данных '${dbConfig.database}' создана успешно!`);
    } else {
      console.log(`База данных '${dbConfig.database}' уже существует.`);
    }

    // Подключаемся к созданной базе данных
    await connect.query(`USE ${dbConfig.database}`);
    console.log(`Подключились к базе данных '${dbConfig.database}'`);
    await createTables(); // Создаем таблицы после успешного создания базы данных
  } catch (err) {
    console.error("Ошибка при проверке или создании базы данных:", err);
    process.exit(1);
  } finally {
    connect.release();
  }
};

const createTables = async () => {
  const connect = await pool.getConnection();
  try {
    await connect.query(`USE ${dbConfig.database}`);

    const createTblNameQuery = `
      CREATE TABLE IF NOT EXISTS tblName (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createChatsQuery = `
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name TEXT,
        phone VARCHAR(15),  
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastMessage TEXT,
        unreadCount INT DEFAULT 0  
      )
    `;

    const createChatMessageQuery = `
      CREATE TABLE IF NOT EXISTS chatMessage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        text TEXT,
        time BIGINT,
        outgoing BOOLEAN,
        content JSON,
        contenttype VARCHAR(50),
        contentsrc VARCHAR(255),
        replyTo VARCHAR(255),
        thread VARCHAR(255),
        \`from\` VARCHAR(50),
        \`to\` VARCHAR(50),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await connect.query(createTblNameQuery);
    console.log("Таблица 'tblName' создана или уже существует.");

    await connect.query(createChatsQuery);
    console.log("Таблица 'chats' создана или уже существует.");

    await connect.query(createChatMessageQuery);
    console.log("Таблица 'chatMessage' создана или уже существует.");
  } catch (err) {
    console.error("Ошибка при создании таблиц:", err);
  } finally {
    connect.release();
  }
};

// Запуск проверки и создания базы данных и таблиц
checkAndCreateDatabase();

app.post("/api/:method", async (req, res) => {
  const { method } = req.params;
  const { source, token, login } = req.body;
  console.log(source, token, login);
  if (method === "getChats") {
    try {
      // Сначала запрашиваем чаты из базы данных
      const [chats] = await connection.query(
        "SELECT * FROM chats ORDER BY timestamp DESC"
      );

      // Если чаты не найдены в базе данных, делаем запрос к API
      if (chats.length === 0) {
        const headers = {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`, // Используем токен из тела запроса
        };

        const response = await axios.post(
          "https://b2288.apitter.com/instances/getChats",
          {
            source,
            login,
          },
          { headers }
        );

        console.log("API Response:", response.data); // Логируем ответ от API

        // Извлекаем массив чатов из ответа
        const messages = Array.isArray(response.data.data.chats)
          ? response.data.data.chats
          : [];

        // Вставляем полученные данные в базу данных
        for (const message of messages) {
          const { name, phone, timestamp, lastMessage, unreadCount } = message;

          const insertQuery = `
            INSERT INTO chats (name, phone, timestamp, lastMessage, unreadCount)
            VALUES (?, ?, FROM_UNIXTIME(?), ?, ?)
            ON DUPLICATE KEY UPDATE 
              lastMessage = VALUES(lastMessage),
              unreadCount = VALUES(unreadCount),
              timestamp = VALUES(timestamp)
          `;

          try {
            await connection.query(insertQuery, [
              name,
              phone,
              timestamp, // timestamp уже в формате UNIX
              lastMessage.body, // Вставляем тело последнего сообщения
              unreadCount,
            ]);
          } catch (insertError) {
            console.error("Ошибка при вставке чата:", insertError.message);
          }
        }

        // После вставки, обновляем список чатов из базы данных
        const [updatedChats] = await connection.query(
          "SELECT * FROM chats ORDER BY timestamp DESC"
        );
        res.json(updatedChats); // Отправляем обновленный список чатов клиенту
      } else {
        // Если чаты найдены в базе данных, отправляем их клиенту
        res.json(chats);
      }
    } catch (error) {
      console.error("Ошибка:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
  if (method === "getChatMessages") {
    const to = "79228059886"; // Замените на нужный номер
    try {
      const [messages] = await pool.query(
        "SELECT * FROM chatMessage ORDER BY timestamp DESC"
      );

      // Если сообщений нет, запрашиваем их из внешнего источника
      if (messages.length === 0) {
        const headers = {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`,
        };

        const response = await axios.post(
          "https://b2288.apitter.com/instances/getChatMessages",
          { source, token, login, to },
          { headers }
        );

        const chatData = response.data;

        // Проверяем, что данные успешно получены и являются массивом
        if (chatData.ok && Array.isArray(chatData.data.messages)) {
          const insertPromises = chatData.data.messages.map(async (message) => {
            const {
              text,
              time,
              outgoing,
              content,
              contenttype,
              contentsrc,
              replyTo,
              thread,
              from,
              to,
            } = message;

            // Проверка на наличие необходимых данных
            if (!time || !outgoing) {
              console.error("Недостаточно данных для вставки:", message);
              return;
            }

            await pool.query(
              "INSERT INTO chatMessage (text, time, outgoing, content, contenttype, contentsrc, replyTo, thread, `from`, `to`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                text || "",
                time,
                outgoing,
                JSON.stringify(content),
                contenttype || "",
                contentsrc || "",
                replyTo || null,
                thread || "",
                from,
                to,
              ]
            );
          });

          await Promise.all(insertPromises);
          console.log("Данные успешно добавлены в chatMessage");
        }

        res.json(chatData);
      } else {
        // Если сообщения уже есть, возвращаем их
        res.json(messages);
      }
    } catch (err) {
      console.error("Ошибка:", err.message);
      res.status(500).json({ error: err.message });
    }
  }

  if (method === "sendMessage") {
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    };
    try {
      const response = await axios.post(
        "https://cloud.controller.touch-api.com/api/sendMessage",
        { source, token, login },
        { headers }
      );

      if (response.data.status === "ok") {
        const message = response.data.message;
        await pool.query("INSERT INTO tblName (message) VALUES (?)", [message]);
        res.json(response.data);
      } else {
        res.status(400).json({ error: "Не удалось отправить сообщение" });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер работает на http://localhost:${port}`);
});
