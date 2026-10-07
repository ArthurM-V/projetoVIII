const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.resolve(__dirname, 'database.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath, (err)=>{
    if(err){
        console.log("Erro ao conectar ao banco:", err.message);
    } else {
        console.log("Conectado ao SQLite");
    }

});

db.run('PRAGMA foreign_keys = ON');

module.exports = db;
