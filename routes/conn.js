var mysql = require('mysql2/promise');

var pool = mysql.createPool({
  host: 'b3gc1pmw5xfvxj8fdgpe-mysql.services.clever-cloud.com',
  user: 'uj6c7bdmvryfdufk',
  password: 'mmOa34mfLrVTBfy7FrJg',
  database: 'b3gc1pmw5xfvxj8fdgpe',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function exe(sql, params) {
  var values = params || [];
  var result = await pool.execute(sql, values);
  return result[0];
}

module.exports = exe;
