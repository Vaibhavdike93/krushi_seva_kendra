var express = require('express');
var mysql = require('mysql');

var util = require('util');

var conn = mysql.createConnection({
  host: 'b3gc1pmw5xfvxj8fdgpe-mysql.services.clever-cloud.com', 
  user:'uj6c7bdmvryfdufk',
    password:'mmOa34mfLrVTBfy7FrJg',
    database:'b3gc1pmw5xfvxj8fdgpe'
});

var exe = util.promisify(conn.query).bind(conn);

module.exports = exe
  