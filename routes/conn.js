var mysql = require('mysql2/promise');

var pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'aviraj',
  database: 'krushi_seva_kendra'
});

async function exe(sql, params) {
  var values = params || [];
  var result = await pool.execute(sql, values);
  return result[0];
}

module.exports = exe;
  
