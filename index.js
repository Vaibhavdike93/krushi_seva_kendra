var express = require('express');
var bodyparser = require('body-parser');
var upload = require('express-fileupload');
var session = require('express-session');
var adminroute = require('./routes/admin');
var userroute = require('./routes/user');
var accounts = require("./routes/accounts");
var forgot = require('./routes/forgot');
const translations = require("./translation");
var app = express();
app.use(bodyparser.urlencoded({ extended: true }));
app.use(upload());
app.use(session({
  secret:'qwertyuioiuytrsdfgh',
    resave: false,
    saveUninitialized: true
}));
app.use(express.json());
app.use(express.static('public/'));

app.use((req,res,next)=>{
res.locals.admin = req.session.admin;
res.locals.user = req.session.user;
next();
});

app.use((req, res, next) => {
  if (req.query.lang) {
    req.session.lang = req.query.lang;   
  }
  res.locals.lang = req.session.lang || "en";

  res.locals.translations = translations[res.locals.lang] || translations["en"];

  next();
});

app.set('view engine', 'ejs');
app.use("/", userroute);
app.use('/admin', adminroute);
app.use("/accounts",accounts);
app.use('/forgot',forgot);

app.listen(1000, function() {
  console.log('Server is running on port 1000');
});