var express = require('express');
var exe = require('./conn');
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
router.get("/conatct",async function(req,res){
  var info = await exe("select * from company_info")
  var paket = {info}
  res.render("user/contact.ejs",paket)
})
router.post("/sendmessage",async function(req,res){
  var d = req.body;
  var sql = `INSERT INTO user_message(name, email, phone, subject, message,)VALUSE(?,?,?,?,?)`;
  var result = await exe(sql,[d.name,d.email,d.phone,d.subject,d.message]);
  res.send(result);
})




module.exports = router;