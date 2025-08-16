var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
  res.render('user/index');
});

router.get('/login', function(req, res) {
  res.render('user/signin.ejs');
});

router.get('/registration', function(req, res) {
  res.render('user/registration.ejs');
});




module.exports = router;