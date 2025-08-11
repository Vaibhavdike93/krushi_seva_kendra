var express = require("express");
var bodyparser = require("body-parser");
var admin_route = require("./routes/admin_route.js");
var user_route = require("./routes/user_route.js");
var session = require("express-session");
var upload = require("express-fileupload");
var app = express();



app.use(bodyparser.urlencoded({extended:true}));
app.use(session({
    secret:"asdfghjkl",
    resave:"true",
    saveUninitialized:true
}))
app.use(upload());
app.use(express.static('public/'));
app.use("/", user_route);     
app.use("/admin", admin_route); 



app.listen(1000);