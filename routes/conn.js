var mysql = require('mysql2/promise');


var pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'aviraj',
  database: 'krushi_seva_kendra'

var util = require('util');

var conn = mysql.createConnection({
  host: 'b3gc1pmw5xfvxj8fdgpe-mysql.services.clever-cloud.com', 
  user:'uj6c7bdmvryfdufk',
    password:'mmOa34mfLrVTBfy7FrJg',
    database:'b3gc1pmw5xfvxj8fdgpe'

});

async function exe(sql, params) {
  var values = params || [];
  var result = await pool.execute(sql, values);
  return result[0];
}

module.exports = exe;
  
