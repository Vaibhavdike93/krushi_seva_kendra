var mysql = require("mysql");
var util = require("util");


var conn  = mysql.createConnection({
    host:"localhot",
    user:"root",
    password:"",
    database:"Krushi_Seva_Kendra"
});


var exe = util.promisify(conn.query).bind(conn);


module.exports = exe;