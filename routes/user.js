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
router.get('/registration', function(req, res) {
  let lang = req.session.lang || 'en';  
  const sql = 'SELECT crop_id, crop_name_en, crop_name_hi, crop_name_mr FROM crops';
  exe(sql, (err, results) => {
    if (err) throw err;

    res.render('user/registration', {
      crops: results,
      lang: lang   
    });
  });
});





module.exports = router;