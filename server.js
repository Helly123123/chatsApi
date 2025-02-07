const express = require("express");
const mysql = require("mysql2"); // или 'mysql', если вы используете его
const app = express();
const port = 3000;

// Настройка подключения к базе данных
const dbConfig = {
  host: "localhost", // ваш хост
  user: "root", // ваш пользователь
  password: "", // ваш пароль
  database: "chats", // ваша база данных
};

// Создание подключения
const db = mysql.createConnection({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
});

// Проверка и создание базы данных
const checkAndCreateDatabase = () => {
  db.connect((err) => {
    if (err) {
      console.error("Ошибка подключения к базе данных: " + err.stack);
      return;
    }
    console.log("Подключено к MySQL");

    // Проверка существования базы данных
    db.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`, (err) => {
      if (err) {
        console.error("Ошибка при создании базы данных: " + err.stack);
        return;
      }
      console.log(
        `База данных '${dbConfig.database}' успешно создана или уже существует.`
      );
      db.changeUser({ database: dbConfig.database }, (err) => {
        if (err) {
          console.error("Ошибка при переключении на базу данных: " + err.stack);
          return;
        }
        console.log(`Подключились к базе данных '${dbConfig.database}'`);
        createTables(); // Создаем таблицы после успешного создания базы данных
      });
    });
  });
};

// Создание таблицы chats
const createTables = () => {
  const createChatsTable = `
  CREATE TABLE IF NOT EXISTS chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unid VARCHAR(255) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      data JSON NOT NULL
  );`;

  db.query(createChatsTable, (err, results) => {
    if (err) {
      console.error("Ошибка при создании таблицы: " + err.stack);
      return;
    }
    console.log("Таблица chats успешно создана или уже существует.");
  });
};

// Пример API для добавления чата
app.use(express.json()); // Для парсинга JSON-данных
app.post("/chats", (req, res) => {
  const { unid, name, lastMessage } = req.body; // Принимаем данные из тела запроса
  const data = JSON.stringify({ name, lastMessage });

  const insertChat = "INSERT INTO chats (unid, data) VALUES (?, ?)";
  db.query(insertChat, [unid, data], (err, results) => {
    if (err) {
      console.error("Ошибка при добавлении чата: " + err.stack);
      return res.status(500).send("Ошибка при добавлении чата.");
    }
    res.status(201).send("Чат успешно добавлен.");
  });
});

// Запуск проверки и создания базы данных и таблиц
checkAndCreateDatabase();

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
