const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json()); // Для парсинга JSON-данных

// Настройка пула соединений
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "chats",
});

// Проверка и создание базы данных
const checkAndCreateDatabase = () => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Ошибка подключения к базе данных: " + err.stack);
      return;
    }
    console.log("Подключено к MySQL");

    // Проверка существования базы данных
    connection.query(
      `CREATE DATABASE IF NOT EXISTS ${pool.config.database}`,
      (err) => {
        if (err) {
          console.error("Ошибка при создании базы данных: " + err.stack);
          connection.release(); // Освобождаем соединение
          return;
        }
        console.log(
          `База данных '${pool.config.database}' успешно создана или уже существует.`
        );

        // Переключаемся на базу данных
        connection.changeUser({ database: pool.config.database }, (err) => {
          if (err) {
            console.error(
              "Ошибка при переключении на базу данных: " + err.stack
            );
            connection.release(); // Освобождаем соединение
            return;
          }
          console.log(`Подключились к базе данных '${pool.config.database}'`);
          createTables(connection); // Передаем соединение в функцию createTables
        });
      }
    );
  });
};

// Создание таблицы chats
const createTables = (connection) => {
  const createChatsTable = `
  CREATE TABLE IF NOT EXISTS chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unid VARCHAR(255) NOT NULL,
      timestamp TEXT,
      data JSON NOT NULL
  );`;

  connection.query(createChatsTable, (err, results) => {
    if (err) {
      console.error("Ошибка при создании таблицы: " + err.stack);
      connection.release(); // Освобождаем соединение
      return;
    }
    console.log("Таблица chats успешно создана или уже существует.");
    connection.release(); // Освобождаем соединение после завершения
  });
};

app.post("/create-table", (req, res) => {
  const { tableName } = req.body; // Получаем имя таблицы из тела запроса

  if (!tableName) {
    return res.status(400).send("Необходимо указать имя таблицы.");
  }

  // Экранируем имя таблицы
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, ""); // Удаляем недопустимые символы

  const createTableQuery = `
  CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uniq VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data JSON NOT NULL
  );`;

  pool.query(createTableQuery, (err, results) => {
    if (err) {
      console.error("Ошибка при создании таблицы: " + err.stack);
      return res.status(500).send("Ошибка при создании таблицы.");
    }
    res.status(201).send(`Таблица '${sanitizedTableName}' успешно создана.`);
  });
});

// Пример API для добавления чата
app.post("/chats", (req, res) => {
  const { unid } = req.body; // Получаем unid из тела запроса
  const name = "Максим"; // Пример имени
  const lastMessage = "Как у тебя дела"; // Пример последнего сообщения
  const data = JSON.stringify({ name, lastMessage, outgoing: true }); // Добавлено поле outgoing

  const insertChat = "INSERT INTO chats (unid, data) VALUES (?, ?)";
  pool.query(insertChat, [unid, data], (err, results) => {
    if (err) {
      console.error("Ошибка при добавлении чата: " + err.stack);
      return res.status(500).send("Ошибка при добавлении чата.");
    }
    res.status(201).send("Чат успешно добавлен.");
  });
});

const checkDb = (method) => {
  return new Promise((resolve, reject) => {
    let query = "";

    if (method === "getChats") {
      query = "SELECT * FROM `chats` ORDER BY timestamp DESC";
      pool.query(query, (err, results) => {
        if (err) {
          return reject(err);
        }
        console.log(results);
        resolve(results);
      });
    } else if (method === "getChatMessages") {
      const tableName = "chatss";
      pool.query(
        "SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        ["chat", tableName],
        (err, results) => {
          if (err) {
            console.error("Ошибка при проверке таблицы: " + err.stack);
            return reject(err); // Возвращаем ошибку
          } else {
            resolve(results);
            console.log(results);
          }
        }
      );
    } else {
      // Если метод не распознан, можно вернуть ошибку
      return reject(new Error("Неизвестный метод: " + method));
    }
  });
};

// Обработка POST-запросов
app.post("/api/:method", async (req, res) => {
  const { source, token, login } = req.body;
  const method = req.params.method;

  try {
    const results = await checkDb(method);

    if (method === "getChats") {
      if (results.length === 0) {
        const response = await axios.post(
          "https://b2288.apitter.com/instances/getChats",
          {
            source,
            login,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Выводим ответ API в консоль
        console.log("Ответ от API:", response.data);

        // Извлекаем массив чатов из ответа
        const chats = response.data.data.chats;

        // Проверяем, является ли chats массивом
        if (!Array.isArray(chats)) {
          return res
            .status(500)
            .json({ error: "Данные чатов не являются массивом." });
        }

        // Подготовим SQL-запрос для вставки данных
        const insertChat =
          "INSERT INTO chats (unid, timestamp, data) VALUES (?, ?, ?)";

        for (const chat of chats) {
          const unid = chat.lastMessage.id.remote; // Используем remote ID как уникальный идентификатор
          const data = JSON.stringify(chat); // Преобразуем объект чата в строку JSON
          const timestamp = chat.timestamp;
          // Используем Promise для обработки асинхронной вставки
          await new Promise((resolve, reject) => {
            pool.query(insertChat, [unid, timestamp, data], (err) => {
              if (err) {
                console.error("Ошибка при добавлении чата: " + err.stack);
                return reject("Ошибка при добавлении чата.");
              }
              resolve();
            });
          });
        }

        // Отправляем ответ от внешнего API обратно клиенту
        return res.status(200).json({
          message: "Чаты успешно добавлены.",
          apiResponse: response.data,
        });
      } else {
        // Если чаты уже существуют, отправляем их клиенту
        return res.status(200).json({
          message: "Чаты уже существуют.",
          chats: results,
        });
      }
    }

    // Если метод не совпадает, можно отправить сообщение об ошибке

    if (method === "getChatMessages") {
      try {
        if (!results.table_exists) {
          const to = "79608151077";
          console.log("сообщени");
          const response = await axios.post(
            "https://b2288.apitter.com/instances/getChatMessages",
            {
              source,
              login,
              to,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          console.log("Ответ от API:", response.data);

          // Здесь вы должны обработать ответ и вставить данные в базу данных
          const messages = response.data.data.messages; // Предполагаем, что данные приходят в нужном формате
          const tableName = "11s15"; // Получаем имя таблицы из тела запроса

          // Экранируем имя таблицы
          const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, ""); // Удаляем недопустимые символы

          const createTableQuery = `
      CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          uniq VARCHAR(255) NOT NULL,
          timestamp VARCHAR(255) NOT NULL,
          data JSON NOT NULL
      );`;

          // Создаем таблицу
          await new Promise((resolve, reject) => {
            pool.query(createTableQuery, (err, results) => {
              if (err) {
                console.error("Ошибка при создании таблицы: " + err.stack);
                return reject(err);
              }
              resolve(results);
            });
          });

          if (!Array.isArray(messages)) {
            return res
              .status(500)
              .json({ error: "Данные чатов не являются массивом." });
          }
          console.log(messages);
          // Подготовим SQL-запрос для вставки данных
          const insertChat = `INSERT INTO ${sanitizedTableName} (uniq, timestamp, data) VALUES (?, ?, ?)`;

          for (const message of messages) {
            const unid = message.thread; // Используем remote ID как уникальный идентификатор
            const data = JSON.stringify(message); // Преобразуем объект чата в строку JSON
            const timestamp = message.time;
            // Используем Promise для обработки асинхронной вставки
            await new Promise((resolve, reject) => {
              pool.query(insertChat, [unid, timestamp, data], (err) => {
                if (err) {
                  console.error("Ошибка при добавлении чата: " + err.stack);
                  return reject("Ошибка при добавлении чата.");
                }
                resolve();
              });
            });
          }

          // Отправляем ответ от внешнего API обратно клиенту
          return res.status(200).json({
            message: "Чаты успешно добавлены.",
            apiResponse: response.data,
          });
        } else {
          let messagesFromDb = [];
          query = `SELECT * FROM  ${sanitizedTableName} ORDER BY timestamp DESC`;
          pool.query(query, (err, results) => {
            if (err) {
              return reject(err);
            }
            console.log(results);
            messagesFromDb = results;
          });
          return res.status(200).json({
            chats: messagesFromDb,
          });
        }
      } catch (error) {
        console.error("Ошибка:", error);
        return res.status(500).json({ error: "Внутренняя ошибка сервера" });
      }
    }

    // Отправляем результаты только один раз
    res.status(200).json(results);
  } catch (error) {
    console.error("Ошибка:", error);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
});

// Запуск проверки и создания базы данных и таблиц
checkAndCreateDatabase();

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
