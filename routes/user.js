var express = require('express');
var exe = require('./conn');
var router = express.Router();
var translations = require("../translation");
var nodemailer = require('nodemailer');
var razorpay = require('./razerpay');
const moment = require('moment');
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const AuthUser = require("./AuthUser");
 const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "gorakshnathdalavi91@gmail.com",
        pass: "yydh qpqv vovi fjsm",
      },
    });



router.get('/login', function(req, res) {
  res.render('user/signin.ejs',{error: null, email: ''});
});

router.post("/login", async function (req, res) {
  let lang = req.session.lang || 'en';  
  var match = `SELECT * FROM users WHERE email = ? AND password = ?`;
  var data = await exe(match, [req.body.email, req.body.password]);

  if (data.length > 0) {
    req.session.user = data[0];
    res.redirect(`/?lang=${lang}`);
  } else {
    res.render("user/signin.ejs", { 
      error: "Invalid email or password", 
      email: req.body.email 
    });
  }
});

router.get('/logout', function(req, res) {
  let lang = req.session.lang || 'en';  
req.session.destroy();
  res.redirect(`/?lang=${lang}`);
});

router.get('/profile',AuthUser,async function(req, res) {
  var userId = req.session.user.user_id;
  var lang = req.session.lang;
const rows = await exe(`
  SELECT u.user_id, u.name, u.email, u.mobile, u.address,
         c.crop_id, c.crop_name_en, c.crop_name_hi, c.crop_name_mr
  FROM users u
  LEFT JOIN users_crops uc ON uc.user_id = u.user_id
  LEFT JOIN crops c ON c.crop_id = uc.crop_id
  WHERE u.user_id = ?
`, [userId]);

if (rows.length > 0) {
  const user = {
    user_id: rows[0].user_id,
    name: rows[0].name,
    email: rows[0].email,
    mobile: rows[0].mobile,
    address: rows[0].address,
    preferredCrops: rows.map(r => r.crop_name_en) 
  };

  var orders = await exe("SELECT * FROM orders WHERE user_id = ? AND language = ? ORDER BY created_at  DESC LIMIT 3",[userId,lang||"en"]);

  res.render("user/profile", { user,search:req.query.search || "" ,orders});
} else {
  res.render("profile", { user: null });
}

});

router.get('/registration', function(req, res) {
  res.render('user/registration.ejs');
});
router.get("/contact",async function(req,res){
  var info = await exe("select * from company_info")
  var paket = {info}
  res.render("user/contact.ejs",paket)
})

router.get("/products",function(req,res){
  res.render("user/products.ejs")
})

router.post("/sendmessage",async function(req,res){
  var d = req.body;
  var sql = `INSERT INTO user_message(name, email, phone, subject, message) VALUES(?,?,?,?,?)`;
  var result = await exe(sql,[d.name,d.email,d.phone,d.subject,d.message]);
  res.send({success: true, message: 'Message sent successfully!'});
})




module.exports = router;