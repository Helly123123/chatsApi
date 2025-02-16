const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const axios = require("axios");
const { pool, checkAndCreateDatabase, checkDb } = require("./db"); // Импортируем функции
const app = express();
const port = 4000;
const apiRoutes = require("./routes/apiRoutes");
const getChatMessages = require("./controllers/getChatsMessages");
const sendMessage = require("./controllers/sendMessage");
const createUserRoutes = require("./controllers/getChats");
const selectInfoFromDb = require("./controllers/infoFromDb");
const dataRouter = require("./controllers/intoMessageFromDb");
app.use(cors());
app.use(express.json());
app.use(apiRoutes);
app.use(getChatMessages);
app.use(sendMessage);
app.use(createUserRoutes);
app.use(selectInfoFromDb);
app.use("/api", dataRouter);

// app.post("/api/:method", async (req, res) => {
//   const { source, token, login, msg, to, unid } = req.body;
//   const method = req.params.method;
//   console.log(`Получен запрос на /api/${method}`); // 1. Проверяем, что запрос вообще приходит
//   console.log(`Query параметры: ${JSON.stringify(req.query)}`); // Добавляем логирование query параметров
//   console.log(`Body запроса: ${JSON.stringify(req.body)}`); // Добавляем логирование body запроса
//   try {
//     const results = await checkDb(method, unid);

//     if (method === "getChats") {
//       if (results.length === 0) {
//         const response = await axios.post(
//           "https://b2288.apitter.com/instances/getChats",
//           {
//             source,
//             login,
//           },
//           {
//             headers: {
//               Authorization: `Bearer ${token}`,
//             },
//           }
//         );

//         // Выводим ответ API в консоль
//         console.log("Ответ от API:", response.data);

//         // Извлекаем массив чатов из ответа
//         const chats = response.data.data.chats;

//         // Проверяем, является ли chats массивом
//         if (!Array.isArray(chats)) {
//           return res
//             .status(500)
//             .json({ error: "Данные чатов не являются массивом." });
//         }

//         // Подготовим SQL-запрос для вставки данных
//         const insertChat =
//           "INSERT INTO chats (unid, timestamp, data) VALUES (?, ?, ?)";

//         for (const chat of chats) {
//           const unid = chat.lastMessage.id.remote; // Используем remote ID как уникальный идентификатор
//           const data = JSON.stringify(chat); // Преобразуем объект чата в строку JSON
//           const timestamp = chat.timestamp;

//           // Используем Promise для обработки асинхронной вставки
//           await new Promise((resolve, reject) => {
//             pool.query(insertChat, [unid, timestamp, data], (err) => {
//               if (err) {
//                 console.error("Ошибка при добавлении чата: " + err.stack);
//                 return reject("Ошибка при добавлении чата.");
//               }
//               resolve();
//             });
//           });
//         }

//         // Отправляем ответ от внешнего API обратно клиенту
//         return res.status(200).json({
//           message: "Чаты успешно добавлены.",
//           apiResponse: response.data,
//         });
//       } else {
//         // Если чаты уже существуют, отправляем их клиенту
//         return res.status(200).json({
//           message: "Чаты уже существуют.",
//           chats: results, // Отправляем существующие чаты
//         });
//       }
//     }

//     let sanitizedTableName = "";

//     if (method === "webhook") {
//       console.log("Обработка вебхука...");
//       const {
//         from,
//         time,
//         text,
//         thread,
//         item,
//         outgoing,
//         replyTo,
//         content,
//         hook_type,
//       } = req.body;
//       const { source, token, login } = req.query;

//       console.log("Данные вебхука: ", {
//         from,
//         to,
//         time,
//         text,
//         thread,
//         item,
//         outgoing,
//         replyTo,
//         content,
//         hook_type,
//       }); //2. Проверяем данные вебхука

//       if (!source || !token || !login) {
//         return res.status(400).json({
//           error: "Необходимы параметры source, token и login в query string",
//         });
//       }

//       if (hook_type !== "message") {
//         console.log("Тип хука не message, выходим.");
//         return res.status(200).send("OK");
//       }
//     }

//     if (method === "sendMessage") {
//       console.log("Началось сообщение");
//       console.log(msg);
//       const messageText = "привет";
//       const message = {
//         to: `79198670001`,
//         text: `${messageText}`,
//         content: messageText ? [] : [{ type: "text", src: "привет" }],
//         time: Math.floor(Date.now() / 1000),
//         outgoing: true,
//       };

//       console.log("Отправка сообщения:", message); // Лог перед отправкой

//       try {
//         const response = await axios.post(
//           "https://b2288.apitter.com/instances/sendMessage",
//           {
//             source,
//             login,
//             msg: msg,
//           },
//           {
//             headers: {
//               Authorization: "Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5",
//             },
//           }
//         );

//         console.log("Ответ от API:", response.data.data.results); // Лог ответа от API

//         const { status } = response.data.data;
//         const results = response.data.data.results;
//         if (status === "ok") {
//           console.log("Статус OK");

//           const unid = results[0].result.thread;

//           // Проверка наличия unid в базе данных
//           const query = `SELECT * FROM chats WHERE unid = ?`;
//           const chatResults = await new Promise((resolve, reject) => {
//             pool.query(query, [unid], (err, results) => {
//               if (err) {
//                 console.error("Ошибка при выполнении запроса: " + err.stack);
//                 return reject(err);
//               }
//               resolve(results);
//             });
//           });

//           if (chatResults.length > 0) {
//             console.log("ОК: Чат найден");
//           } else {
//             console.log("Не ОК: Чата нет! Создаю...");
//           }

//           // Проверка существования таблицы
//           const tableCheckQuery = `SELECT COUNT(*) AS table_exists FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`;
//           const tableExists = await new Promise((resolve, reject) => {
//             pool.query(tableCheckQuery, ["chats", unid], (err, results) => {
//               if (err) {
//                 console.error("Ошибка при проверке таблицы: " + err.stack);
//                 return reject(err); // Возвращаем ошибку
//               } else {
//                 resolve(results);
//               }
//             });
//           });

//           if (tableExists[0].table_exists > 0) {
//             const messageData = {
//               to: msg.to,
//               from: "79198670001", // или другое значение
//               item: results[0].result.item || "3A05B1DBFE70E35181EE", // пример значения
//               text: msg.text,
//               time: Date.now() * 1000, // Пример времени
//               source: "whatsapp",
//               thread: unid,
//               content: msg.content,
//               replyTo: null,
//               outgoing: msg.outgoing,
//             };

//             // Вставка данных в таблицу
//             const insertChat = `INSERT INTO \`${unid}\` (uniq, timestamp, data) VALUES (?, ?, ?)`;
//             await new Promise((resolve, reject) => {
//               pool.query(
//                 insertChat,
//                 [unid, Date.now(), JSON.stringify(messageData)],
//                 (err, results) => {
//                   if (err) {
//                     console.error("Ошибка при вставке данных: " + err.stack);
//                     return reject(err);
//                   }
//                   console.log("Данные успешно вставлены.");
//                   resolve(results);
//                 }
//               );
//             });
//           } else {
//             console.log("Таблица не существует. Создаю таблицу...");

//             // Создание таблицы
//             const createTableQuery = `
//             CREATE TABLE IF NOT EXISTS \`${unid}\` (
//               id INT AUTO_INCREMENT PRIMARY KEY,
//               uniq VARCHAR(255) NOT NULL,
//               timestamp VARCHAR(255) NOT NULL,
//               data JSON NOT NULL
//             );`;
//             await new Promise((resolve, reject) => {
//               pool.query(createTableQuery, (err, results) => {
//                 if (err) {
//                   console.error("Ошибка при создании таблицы: " + err.stack);
//                   return reject(err);
//                 }
//                 console.log("Таблица успешно создана.");
//                 resolve(results);
//               });
//             });
//           }

//           return res.status(200).json({ ok: true, unid, data: response.data });
//         } else {
//           return res
//             .status(400)
//             .json({ error: "Не удалось отправить сообщение." });
//         }
//       } catch (error) {
//         console.error("Ошибка при выполнении запроса:", error.message); // Лог ошибки
//         return res.status(500).json({ error: "Внутренняя ошибка сервера." });
//       }
//     }

//     if (method === "getChatMessages") {
//       try {
//         if (results[0].table_exists === 0) {
//           console.log("Получение сообщений...");
//           const response = await axios.post(
//             "https://b2288.apitter.com/instances/getChatMessages",
//             {
//               source,
//               login,
//               to,
//             },
//             {
//               headers: {
//                 Authorization: "Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5",
//               },
//             }
//           );

//           if (response.data === 401) {
//             return res.status(200).json({ errorMessage: 401, ok: true });
//           }

//           const messages = response.data.data.messages;

//           sanitizedTableName = response.data.data.chat.id?._serialized;

//           console.log("Создаваемая таблица:", sanitizedTableName);

//           const createTableQuery = `
//         CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (
//           id INT AUTO_INCREMENT PRIMARY KEY,
//           uniq VARCHAR(255) NOT NULL,
//           timestamp VARCHAR(255) NOT NULL,
//           data JSON NOT NULL
//         );`;

//           await new Promise((resolve, reject) => {
//             pool.query(createTableQuery, (err) => {
//               if (err) {
//                 console.error("Ошибка при создании таблицы: " + err.stack);
//                 return reject(err);
//               }
//               console.log(
//                 `Таблица '${sanitizedTableName}' успешно создана или уже существует.`
//               );
//               resolve();
//             });
//           });

//           if (!Array.isArray(messages)) {
//             return res
//               .status(500)
//               .json({ error: "Данные чатов не являются массивом." });
//           }

//           const insertChat = `INSERT INTO \`${sanitizedTableName}\` (uniq, timestamp, data) VALUES (?, ?, ?)`;

//           for (const message of messages) {
//             const unid = message.thread;
//             const data = JSON.stringify(message);
//             const timestamp = message.time;

//             await new Promise((resolve, reject) => {
//               pool.query(insertChat, [unid, timestamp, data], (err) => {
//                 if (err) {
//                   console.error("Ошибка при добавлении чата: " + err.stack);
//                   return reject("Ошибка при добавлении чата.");
//                 }
//                 resolve();
//               });
//             });
//           }

//           let messagesFromDb = [];
//           const query = `SELECT * FROM \`${sanitizedTableName}\` ORDER BY timestamp DESC`;

//           await new Promise((resolve, reject) => {
//             pool.query(query, (err, results) => {
//               if (err) {
//                 console.error(
//                   "Ошибка при получении сообщений из базы данных: " + err.stack
//                 );
//                 return reject(err);
//               }
//               messagesFromDb = results;
//               resolve();
//             });
//           });

//           return res.status(200).json({
//             ok: true,
//             messages: messagesFromDb,
//           });
//         } else {
//           console.log("Таблица уже существует, извлечение сообщений...");

//           const response = await axios.post(
//             "https://b2288.apitter.com/instances/getChatMessages",
//             {
//               source,
//               login,
//               to,
//             },
//             {
//               headers: {
//                 Authorization: "Bearer 9bddaafd-2c8d-4840-96d5-1c19c0bb4bd5",
//               },
//             }
//           );

//           if (response.data === 401) {
//             return res.status(200).json({ errorMessage: 401, ok: true });
//           }
//           sanitizedTableName = response.data.data.chat.id?._serialized;
//           console.log(sanitizedTableName);
//           let messagesFromDb = [];
//           const query = `SELECT * FROM \`${sanitizedTableName}\` ORDER BY timestamp DESC`;

//           await new Promise((resolve, reject) => {
//             pool.query(query, (err, results) => {
//               if (err) {
//                 console.error(
//                   "Ошибка при получении сообщений из базы данных: " + err.stack
//                 );
//                 return reject(err);
//               }
//               messagesFromDb = results;
//               resolve();
//             });
//           });
//           return res.status(200).json({
//             ok: true,
//             messages: messagesFromDb,
//           });
//         }
//       } catch (error) {
//         console.error("Ошибка:", error);
//         return res.status(500).json({ error: "Внутренняя ошибка сервера" });
//       }
//     }
//     // Отправляем результаты только один раз
//     res.status(200).json(results);
//   } catch (error) {
//     console.error("Ошибка:", error);
//     res.status(500).json({ error: "Внутренняя ошибка сервера" });
//   }
// });

app.get("/api/hello", (req, res) => {
  res.json({ message: "Привет!" });
});

checkAndCreateDatabase();

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
