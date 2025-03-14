const express = require("express");
const { pool, connectToDatabase } = require("../db");
const router = express.Router();
const { setGlobalTableName } = require("../globals");

// Маршрут для удаления сообщения и изменения его текста
router.post("/api/delete-messages", async (req, res) => {
  const { uniq, item, login } = req.body; // Получаем uniq и item из тела запроса
  await connectToDatabase("whatsapp", login, "token");
  setGlobalTableName(`whatsapp}_${login}_token`);
  console.log("Полученные данные:", { uniq, item, login });

  if (!uniq || !item) {
    return res.status(400).json({ message: "Необходимо указать uniq и item." });
  }

  try {
    // 1. Получаем сообщение из базы данных
    const [rows] = await pool.query(
      `SELECT data FROM \`${uniq}\` WHERE uniq = ?`,
      [item]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Сообщение не найдено." });
    }

    // 2. Получаем data (предполагаем, что data - это JavaScript object)
    let data = rows[0].data;

    // *** ВЫВОД СТРУКТУРЫ DATA ***
    console.log("Data before modification:", JSON.stringify(data, null, 2));

    // 3. Изменяем data.text
    if (data) {
      data.text = "Сообщение удалено";
    }
    console.log(data);
    // 4. Сериализуем data обратно в JSON-строку
    const newData = JSON.stringify(data);

    // 5. Обновляем сообщение в базе данных, устанавливая delete = true и обновленный data
    const sql = `UPDATE \`${uniq}\` SET \`delete\` = true, data = ? WHERE uniq = ?`;
    console.log("SQL:", sql);

    await pool.query(sql, [newData, item]);

    return res
      .status(200)
      .json({ message: "Сообщение успешно удалено и изменено." });
  } catch (error) {
    console.error("Ошибка при удалении сообщения:", error.message, error.stack);
    return res
      .status(500)
      .json({ message: "Ошибка сервера при удалении сообщения." });
  }
});

module.exports = router;
