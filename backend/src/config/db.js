const sql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    server: process.env.DB_SERVER,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false,
        trustServerCertificate: true // essencial para rodar o SQL Server localmente sem erros
    }
};

async function connectToDatabase() {
    try {
        const pool = await sql.connect(dbConfig);
        console.log('✅ Banco de dados SQL Server conectado com sucesso!');
        return pool;
    } catch (err) {
        console.error('❌ Erro ao conectar no banco de dados: ', err);
    }
}

module.exports = { sql, connectToDatabase, dbConfig };
