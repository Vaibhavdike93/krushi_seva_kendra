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


router.get('/', function(req, res) {
  
  res.render('user/index');
});





router.get("/add_tocart",async function(req, res) {
  res.render("user/add_tocart.ejs");
})




router.get("/add_to_cart",function(req,res){
  res.render("user/add_to_cart.ejs")
})


router.get("/conatct",async function(req,res){
  var info = await exe("select * from company_info")
  var paket = {info}
  res.render("user/contact.ejs",paket)
})
   
 
router.get("/category/:categoryId", (req, res) => {
  const lang = req.session.lang || "en";  
  const categoryId = req.params.categoryId;

  const query = `
    SELECT 
        p.product_id,
        p.product_name,
        p.description,
        p.dosage,
        p.features,
        p.season,
        p.main_image,
        p.stock_quantity,
        p.discount,
        b.brand_id,
        CASE 
            WHEN ? = 'hi' THEN b.brand_name_hi
            WHEN ? = 'mr' THEN b.brand_name_mr
            ELSE b.brand_name_en
        END AS brand_name,
        c.category_id,
        CASE 
            WHEN ? = 'hi' THEN c.category_name_hi
            WHEN ? = 'mr' THEN c.category_name_mr
            ELSE c.category_name_en
        END AS category_name,
        v.variant_id,
        v.weight,
        v.price
    FROM product p
    JOIN brands b ON p.brand_id = b.brand_id
    JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN product_variants v ON p.product_id = v.product_id
    WHERE p.category_id = ? AND p.language = ?
    ORDER BY category_name ASC, brand_name ASC, p.product_name ASC;
  `;

  exe(query, [lang, lang, lang, lang, categoryId, lang], (err, results) => {
    if (err) {
      console.error("SQL Error:", err.sqlMessage);
      return res.status(500).send("Database error");
    }

    const productsMap = {};
    results.forEach(row => {
      if (!productsMap[row.product_id]) {
        productsMap[row.product_id] = {
          product_id: row.product_id,
          product_name: row.product_name,
          description: row.description,
          main_image: row.main_image,
          discount: row.discount || 0,
          brand_name: row.brand_name,
          category_name: row.category_name,
          variants: []
        };
      }

      if (row.variant_id) {
        productsMap[row.product_id].variants.push({
          variant_id: row.variant_id,
          weight: row.weight,
          basePrice: row.price,
          discountPercent: row.discount || 0,
          discountedPrice: row.discount && row.discount > 0 
                            ? Math.round(row.price - (row.price * row.discount / 100))
                            : row.price
        });
      }
    });

    const finalProducts = Object.values(productsMap);

    res.render("user/category", { products: finalProducts, lang });
  });
});













module.exports = router;