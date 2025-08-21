var express = require('express');
var exe = require('./conn');
var router = express.Router();
var translations = require("../translation");





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




router.get('/', async function(req, res) {
    
   
    if(req.query.lang){
        req.session.language = req.query.lang; 
    }
    
    var lang = req.session.language || "en";
    var categories = await exe("SELECT * FROM categories ")
     const search = req.query.search || "";
    res.render('user/index', {
        categories: categories,
        lang: lang,
        translations: translations[lang],
        search
    });
});
router.get("/product", async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const search = req.query.search ? req.query.search.trim() : "";
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;

    let categoryCol = "c.category_name_en";
    let brandCol = "b.brand_name_en";

    if (lang === "hi") {
      categoryCol = "c.category_name_hi";
      brandCol = "b.brand_name_hi";
    } else if (lang === "mr") {
      categoryCol = "c.category_name_mr";
      brandCol = "b.brand_name_mr";
    }

    let countSql = `
      SELECT COUNT(*) as total
      FROM product p
      JOIN product_variants v ON p.product_id = v.product_id
      WHERE p.language = ?
    `;
    const countParams = [lang];
    if (search) {
      countSql += " AND p.product_name LIKE ?";
      countParams.push(`%${search}%`);
    }
    const totalResult = await exe(countSql, countParams);
    const totalProducts = totalResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    let sql = `
      SELECT 
          p.product_id,
          p.product_name,
          ${categoryCol} AS category_name,
          ${brandCol} AS brand_name,
          v.weight,
          v.price AS original_price,
          p.discount,
          p.stock_quantity,
          (v.price * p.discount / 100) AS discount_amount,
          (v.price - (v.price * p.discount / 100)) AS final_price
      FROM product p
      JOIN categories c ON p.category_id = c.category_id
      JOIN brands b ON p.brand_id = b.brand_id
      JOIN product_variants v ON p.product_id = v.product_id
      WHERE p.language = ?
    `;
    const params = [lang];

    if (search) {
      sql += " AND p.product_name LIKE ?";
      params.push(`%${search}%`);
    }

    sql += `
      AND v.price = (
          SELECT MIN(v2.price)
          FROM product_variants v2
          WHERE v2.product_id = p.product_id
      )
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    const products = await exe(sql, params);

    const startCount = totalProducts === 0 ? 0 : offset + 1;
    const endCount = offset + products.length;

    const category = await exe("SELECT * FROM categories");
    const brands = await exe("SELECT * FROM brands");

    res.render("user/product", {
      products,
      lang,
      category,
      brands,
      search,
      currentPage: page,
      totalPages,
      startCount,
      endCount,
      totalProducts
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading products");
  }
});




router.post("/filter-products", (req, res) => {
    const { categories, brands, price } = req.body;
    const lang = req.session.lang || "en";

    const categoryCol = lang === 'mr' ? 'c.category_name_mr' : lang === 'hi' ? 'c.category_name_hi' : 'c.category_name_en';
    const brandCol = lang === 'mr' ? 'b.brand_name_mr' : lang === 'hi' ? 'b.brand_name_hi' : 'b.brand_name_en';

   let query = `
    SELECT 
        p.product_id, p.product_name, p.stock_quantity, p.main_image, p.discount,
        ${categoryCol} AS category_name,
        ${brandCol} AS brand_name,
        v.variant_id, v.weight, v.price
    FROM product p
    LEFT JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN brands b ON p.brand_id = b.brand_id
    LEFT JOIN product_variants v ON p.product_id = v.product_id
    WHERE 1=1 AND p.language = ?
`;

let params = [lang];

if (categories && categories.length) {
    const placeholders = categories.map(() => '?').join(',');
    query += ` AND p.category_id IN (${placeholders})`;
    params.push(...categories);
}

if (brands && brands.length) {
    const placeholders = brands.map(() => '?').join(',');
    query += ` AND p.brand_id IN (${placeholders})`;
    params.push(...brands);
}

if (price) {
    query += ` AND v.price <= ?`;
    params.push(price);
}


exe(query, params, (err, results) => {
    if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
    }

    let products = {};
    results.forEach(r => {
       if (!products[r.product_id]) {
    products[r.product_id] = {
        product_id: r.product_id,
        product_name: r.product_name,
        stock_quantity: r.stock_quantity,
        category_name: r.category_name,   
        brand_name: r.brand_name,         
        main_image: r.main_image,
        discount: r.discount || 0,
        variants: []
    };
}


        if (r.variant_id) {
            let discountedPrice = r.price;
            let savings = 0;

            if (r.discount && r.discount > 0) {
                discountedPrice = r.price - (r.price * r.discount / 100);
                savings = r.price - discountedPrice;
            }

            products[r.product_id].variants.push({
                variant_id: r.variant_id,
                weight: r.weight,
                original_price: r.price,
                discount: r.discount || 0,
                discounted_price: Math.round(discountedPrice),
                you_save: Math.round(savings)
            });
        }
    });

    Object.values(products).forEach(p => {
        if (p.variants.length > 0) {
            p.original_price = p.variants[0].original_price;
            p.final_price = p.variants[0].discounted_price;
            p.discount_amount = p.variants[0].you_save;
        } else {
            p.original_price = 0;
            p.final_price = 0;
            p.discount_amount = 0;
        }
    });

    res.json(Object.values(products));
});

});

router.get("/product_details/:id",async function(req,res){
  var id = req.params.id;
var product = await exe(`SELECT * FROM product 
  LEFT JOIN categories ON product.category_id = categories.category_id 
  LEFT JOIN brands ON product.brand_id = brands.brand_id
  LEFT JOIN product_variants ON product.product_id = product_variants.product_id
  WHERE product.product_id = ? AND product.language = ?`, [id,req.session.lang || 'en']);
  console.log(product);
  res.render("user/product_details.ejs",{
    search: req.query.search || '',
    product:product[0]
  });
})










router.get("/add_tocart/:id",async function(req, res) {
var id = req.params.id;
var product = await exe(`SELECT * FROM product 
  LEFT JOIN categories ON product.category_id = categories.category_id 
  LEFT JOIN brands ON product.brand_id = brands.brand_id
  LEFT JOIN product_variants ON product.product_id = product_variants.product_id
  WHERE product.product_id = ? AND product.language = ?`, [id,req.session.lang || 'en']);
  console.log(product);
  res.render("user/add_tocart.ejs",
    { search: req.query.search || '',
      product:product[0] || null
     }
  );
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