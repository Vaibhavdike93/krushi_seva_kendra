var express = require('express');
var router = express.Router();
var exe = require('./conn');
var CheckLogin = require("./CheckLogin");

router.get('/', function(req, res) {
  res.render('admin/index.ejs');
});

router.get('/profile',function(req,res){
    res.render("admin/profile");
})


module.exports = router;