// globals.js
let globalTableName = "";

const setGlobalTableName = (name) => {
  globalTableName = name;
  console.log("Новое имя ", name);
};

const getGlobalTableName = () => {
  return globalTableName;
};

module.exports = { setGlobalTableName, getGlobalTableName };
