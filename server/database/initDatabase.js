const fs = require('fs');
const path = require('path');
const db = require('./database');

const schemaPath = path.resolve(__dirname, 'schema.sql');

const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err)=>{
    if(err){
        console.error("Erro ao criar o banco:", err.message);
    } else{
        console.log("Banco criado com sucesso!");
    }

    db.close();
});