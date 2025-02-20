const clients = new Set(); // Хранит подключенных клиентов для SSE

// Функция для отправки сообщений клиентам SSE
const sendSSE = (data) => {
  clients.forEach((client) => {
    if (client.writable) {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  });
};

// Функция для добавления клиента
const addClient = (res) => {
  clients.add(res);
};

// Функция для удаления клиента
const removeClient = (res) => {
  clients.delete(res);
};

// Экспортируем функции
module.exports = {
  sendSSE,
  addClient,
  removeClient,
};
