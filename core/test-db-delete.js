const { createPool } = require('mysql2/promise');
const DB_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const DB_PORT = Number.parseInt(process.env.MYSQL_PORT || '4409', 10);
const DB_USER = process.env.MYSQL_USER || 'root';
const DB_PASS = process.env.MYSQL_PASSWORD || '123456';
const DB_NAME = process.env.MYSQL_DATABASE || 'qq_farm_bot';

async function test() {
    const pool = createPool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, database: DB_NAME });
    try {
        const [accounts] = await pool.query('SELECT * FROM accounts');
        if (accounts.length > 0) {
           const targetId = accounts[accounts.length - 1].id;
           console.log('Attempting to delete account:', targetId);
           await pool.query('DELETE FROM accounts WHERE id = ?', [targetId]);
           console.log('Delete successful');
        } else {
           console.log('No accounts to test');
        }
    } catch(e) {
        console.error('Delete failed:', e.message);
    }
    process.exit(0);
}
test();
