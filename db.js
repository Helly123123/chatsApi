const mysql = require("mysql2/promise");
const { getGlobalTableName } = require("./globals");
require("dotenv").config();

const globalName = getGlobalTableName();
// Настройка пула соединений
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT,
});

const connectToDatabase = async (source, login, token) => {
  const dbName = `${source}_${login}_${token}`;
  console.log("подключаем к бд", dbName);
  const connection = await pool.getConnection();

  try {
    const [results] = await connection.query(
      "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName]
    );

    if (results.length === 0) {
      // Если базы данных не существует, создаём её
      await connection.query(`CREATE DATABASE ${dbName}`);
      console.log(`База данных ${dbName} успешно создана.`);
    }

    // Переключаемся на базу данных
    await connection.changeUser({ database: dbName });
    await createTables(connection); // Создание таблиц
    return connection;
  } catch (err) {
    throw new Error("Ошибка при работе с базой данных: " + err.stack);
  } finally {
    connection.release(); // Освобождаем соединение
  }
};

const connectToDatabaseByName = async (dbName) => {
  const connection = await pool.getConnection();

  try {
    // Переключаемся на указанную базу данных
    await connection.changeUser({ database: dbName });
    console.log(`Подключение к базе данных ${dbName} успешно установлено.`);
    return connection; // Возвращаем соединение
  } catch (err) {
    throw new Error("Ошибка при подключении к базе данных: " + err.stack);
  } finally {
    // Здесь мы не освобождаем соединение, так как оно может понадобиться для дальнейших операций
  }
};
// Создание таблицы chats
const createTables = async (connection) => {
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

  await connection.query(createChatsTable);
  console.log("Таблица chats успешно создана или уже существует.");
};

// Функция для получения данных из всех баз данных
const fetchDataFromAllDatabases = async (source, login, token) => {
  const allData = [];
  const dbName = `${source}_${login}_${token}`;

  // Получаем список баз данных
  const databases = await getDatabaseNames();

  for (const db of databases) {
    // Проверяем, содержит ли имя базы данных "whatsapp"
    if (db.toLowerCase().includes("whatsapp")) {
      allData.push(db);
    }
  }

  return allData;
};

// Функция для получения названий баз данных
const getDatabaseNames = async () => {
  const [results] = await pool.query("SHOW DATABASES");
  return results.map((db) => db.Database);
};

// Функция проверки базы данных
const checkDb = async (method, tableName) => {
  const globalTableName = getGlobalTableName();
  let query = "";
  console.log(`checkDb вызван с методом: ${method}`);

  if (method === "getChats") {
    query = `SELECT * FROM \`${globalTableName}\` ORDER BY timestamp DESC`;
    const [results] = await pool.query(query);
    return results;
  } else if (method === "sendMessage") {
    const results = "122";
    console.log("sendMessage");
    return results;
  } else if (method === "getChatMessages") {
    const [results] = await pool.query(
      "SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [globalTableName, tableName]
    );
    return results;
  } else if (method === "webhook") {
    console.log("вебхук метод");
  } else {
    throw new Error("Неизвестный метод: " + method);
  }
};

// Экспортируем функции
module.exports = {
  pool,
  connectToDatabase,
  checkDb,
  fetchDataFromAllDatabases,
  connectToDatabaseByName,
};
