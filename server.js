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
const deleteMessage = require("./controllers/deleteMessage");
const clearMessages = require("./controllers/clearAllNewMessages");
const multer = require("multer");

// Middleware
app.use(cors());
app.use(express.json());
app.use(apiRoutes);
app.use(getChatMessages);
app.use(sendMessage);
app.use(createUserRoutes);
app.use(selectInfoFromDb);
app.use(clearMessages);
app.use(deleteMessage);
app.use("/api", dataRouter);

// Настройка хранилища для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname +
        "-" +
        uniqueSuffix +
        "." +
        file.originalname.split(".").pop()
    );
  },
});

const upload = multer({ storage: storage });

// Обработка загрузки файлов
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const fileUrl = `https://hellychat.apitter.com/api/uploads/${req.file.filename}`; // Используем твой домен и добавляем /api/uploads
  res.send({ fileUrl });
});

app.use("/api/uploads", express.static("uploads"));

// Логика для SSE
let clients = [];

// Обработчик для SSE
const sseHandler = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Добавляем клиента в массив
  clients.push(res);

  // Удаляем клиента, если соединение закрыто
  req.on("close", () => {
    clients = clients.filter((client) => client !== res);
  });
};

// Функция для отправки сообщения всем подключенным клиентам
const sendToClients = (message) => {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(message)}\n\n`);
  });
};

// Пример маршрута для SSE
app.get("/sse", sseHandler);

// Пример функции, которая будет отправлять сообщения
app.post("/send-message", (req, res) => {
  const message = req.body.message;

  // Здесь ваша логика для сохранения сообщения в БД или другой обработке
  // Например, вы можете добавить логику для генерации ответов
  let responseMessage;

  // Простейшая логика для ответа
  if (message.includes("?")) {
    responseMessage =
      "Это хороший вопрос! Я не знаю ответа на него, но могу помочь с чем-то другим.";
  } else {
    responseMessage = "Спасибо за ваше сообщение!";
  }

  // Уведомляем всех клиентов о новом сообщении
  sendToClients({ message });

  // Уведомляем всех клиентов о ответе
  sendToClients({ message: responseMessage });

  res.status(200).send("Message sent");
});

// Проверка и создание базы данных
checkAndCreateDatabase();

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на http://localhost:${port}`);
});
