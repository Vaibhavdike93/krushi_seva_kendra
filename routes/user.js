var express = require('express');
var exe = require('./conn');
var router = express.Router();
var translations = require("../translation");


router.get('/product', function(req, res) {
  res.render('user/product');
})
router.get('/', async function(req, res) {
    
   
    if(req.query.lang){
        req.session.language = req.query.lang; 
    }
    
    var lang = req.session.language || "en";
    var categories = await exe("SELECT * FROM categories ")
    
    res.render('user/index', {
        categories: categories,
        lang: lang,
        translations: translations[lang]
    });
});


router.get('/login', function(req, res) {
  res.render('user/signin.ejs',{error: null, email: ''});
});

router.post("/login", async function (req, res) {
  var match = `SELECT * FROM users WHERE email = ? AND password = ?`;
  var data = await exe(match, [req.body.email, req.body.password]);

  if (data.length > 0) {
    req.session.user = data[0];
    res.redirect("/");
  } else {
    res.render("user/signin.ejs", { 
      error: "Invalid email or password", 
      email: req.body.email 
    });
  }
});



router.get('/logout', function(req, res) {
req.session.destroy();
  res.redirect('/');
});

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




router.post('/registration', async (req, res) => {
  try {
    const { name, email, mobile, password, crops, address } = req.body;

    const insertUserSql = `INSERT INTO users (name, email, mobile, password, address) VALUES (?, ?, ?, ?, ?)`;
    
    const result = await exe(insertUserSql, [name, email, mobile, password, address]);
    const userId = result.insertId; 

    if (Array.isArray(crops)) {
      const cropValues = crops.map(cropId => [userId, cropId]); 
      const insertCropsSql = `INSERT INTO users_crops (user_id, crop_id) VALUES ?`;
      await exe(insertCropsSql, [cropValues]);
    }

    // res.send('User registered successfully!');
    res.redirect('/login'); 
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
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
router.get("/category", async function(req, res) {
    var cat = req.query.category_id;
    if(req.query.lang){
        req.session.language = req.query.lang; 
    }
    var lang = req.session.language || "en";

    var categories = await exe("SELECT * FROM categories");

    var sql = "";
    var products = [];

    if(cat && cat != "all"){
        sql = `SELECT p.*, c.category_name_en, c.category_name_mr
               FROM product p
               JOIN categories c ON p.category_id = c.category_id
               WHERE p.category_id=?`;
        products = await exe(sql, [cat]);
    } else {
        sql = `SELECT p.*, c.category_name_en, c.category_name_mr
               FROM product p
               JOIN categories c ON p.category_id = c.category_id`;
        products = await exe(sql);
    }

    // प्रत्येक product साठी variants fetch करा
    for(let i = 0; i < products.length; i++){
        var variants = await exe("SELECT * FROM product_variants WHERE product_id=?", [products[i].product_id]);
        products[i].variants = variants;  // attach variants to product
    }

    res.render("user/category", {
        translations: translations[lang],
        products: products,
        cat: cat || "all"
    });
});







module.exports = router;