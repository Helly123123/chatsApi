// utils/db.js
const mysql = require("mysql2");

// Настройка пула соединений
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "68b329da9893e34099c7",
  // password: "root",
  database: "chats",
  port: 3306,
});

const checkAndCreateDatabase = () => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Ошибка подключения к базе данных: " + err.stack);
      return;
    }
    console.log("Подключено к MySQL");

    connection.query(`CREATE DATABASE IF NOT EXISTS recored`, (err) => {
      if (err) {
        console.error("Ошибка при создании базы данных: " + err.stack);
        connection.release(); // Освобождаем соединение
        return;
      }
      console.log(`База данных recored успешно создана или уже существует.`);

      // Переключаемся на базу данных
      connection.changeUser({ database: pool.config.database }, (err) => {
        if (err) {
          console.error("Ошибка при переключении на базу данных: " + err.stack);
          connection.release(); // Освобождаем соединение
          return;
        }
        console.log(`Подключились к базе данных '${pool.config.database}'`);
        createTables(connection); // Передаем соединение в функцию createTables
      });
    });
  });
};

// Создание таблицы chats
const createTables = (connection) => {
  const createChatsTable = `
  CREATE TABLE IF NOT EXISTS chats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      uniq VARCHAR(255) NOT NULL,
      timestamp TEXT,
      newMessage INT,
      data JSON NOT NULL,
      w VARCHAR(255),
      u VARCHAR(255)
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

const checkDb = (method, tableName) => {
  return new Promise((resolve, reject) => {
    let query = "";
    console.log(`checkDb вызван с методом: ${method}`);
    if (method === "getChats") {
      query = "SELECT * FROM `chats` ORDER BY timestamp DESC";
      pool.query(query, (err, results) => {
        if (err) {
          return reject(err);
        }

        resolve(results);
      });
    } else if (method === "sendMessage") {
      const results = "122";
      console.log("sendMessage");
      resolve(results);
    } else if (method === "getChatMessages") {
      // const tableName = "chatss";
      pool.query(
        "SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        ["chats", tableName],
        (err, results) => {
          if (err) {
            console.error("Ошибка при проверке таблицы: " + err.stack);
            return reject(err); // Возвращаем ошибку
          } else {
            resolve(results);
          }
        }
      );
    } else if (method === "webhook") {
      console.log("вебхук метод");
    } else {
      // Если метод не распознан, можно вернуть ошибку
      return reject(new Error("Неизвестный метод: " + method));
    }
  });
};

// Экспортируем функции
module.exports = {
  pool: pool.promise(), // Здесь мы корректно экспортируем pool с промисами
  checkAndCreateDatabase,
  createTables,
  checkDb,
};
