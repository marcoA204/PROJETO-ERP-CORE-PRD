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

// A conexão é criada UMA vez e reaproveitada (antes, cada requisição abria uma nova).
let poolPromise = null;

function connectToDatabase() {
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig)
            .then((pool) => {
                console.log('✅ Banco de dados SQL Server conectado com sucesso!');
                return pool;
            })
            .catch((err) => {
                poolPromise = null; // permite tentar de novo na próxima requisição
                console.error('❌ Erro ao conectar no banco de dados:', err.message);
                throw err;          // quem chamou precisa saber que falhou
            });
    }
    return poolPromise;
}

module.exports = { sql, connectToDatabase, dbConfig };