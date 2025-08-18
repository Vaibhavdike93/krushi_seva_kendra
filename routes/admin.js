var express = require('express');
var router = express.Router();
var exe = require('./conn');
var CheckLogin = require("./CheckLogin");
var translations = require('../translation');



router.get('/', function(req, res) {
  res.render('admin/index.ejs');
});

router.get('/profile',function(req,res){
    res.render("admin/profile");
})

router.get("/Add_product_Brand",async function(req,res){
  
  res.render("admin/Add_product_Brand.ejs")
})

router.post("/add_brand", async function (req, res) {
  var d = req.body;
  let filename = "";

  if (req.files && req.files.brandImage) {
    filename = new Date().getTime() + req.files.brandImage.name;
    await req.files.brandImage.mv("public/uploads/" + filename);
  }

  var sql = `
    INSERT INTO brands 
    (brand_name_en, brand_name_hi, brand_name_mr, brand_image) 
    VALUES (?, ?, ?, ?)
  `;

  var result = await exe(sql, [
    d.brandNameEn?.trim(),
    d.brandNameHi?.trim(),
    d.brandNameMr?.trim(),
    filename
  ]);

  res.redirect("/admin/add_product_brand");
});


router.get("/brand_list", async function (req, res) {
  var sql = `SELECT * FROM brands ORDER BY brand_id DESC`; 
  var brands = await exe(sql);
  res.render("admin/brand_list.ejs", { brands });
});




router.get("/delete_brand/:id",async function(req,res){
  var id = req.params.id;
  var sql = `DELETE FROM product_barand WHERE brand_id = ?`;
  var result = await exe(sql,[id]);
   res.redirect("/admin/Add_product_Brand")
});

router.get("/add_category",function(req,res){
  res.render("admin/add_category.ejs")
});

router.post("/add_category", async function(req, res) {
    var d = req.body;
    let filename = "";

    // Image upload
    if (req.files && req.files.categoryImage) {
        filename = new Date().getTime() + req.files.categoryImage.name;
        await req.files.categoryImage.mv("public/uploads/" + filename);
    }

    // Insert into DB
    var sql = `INSERT INTO categories 
               (category_name_en, category_name_hi, category_name_mr, category_image) 
               VALUES (?, ?, ?, ?)`;
    var result = await exe(sql, [
        d.categoryNameEn.trim(),
        d.categoryNameHi.trim(),
        d.categoryNameMr.trim(),
        filename
    ]);

    res.redirect("/admin/category_list");
});



router.get("/category_list",async function(req,res){
  var sql = `SELECT * FROM categories`; 
  var categories = await exe(sql);
  res.render("admin/category_list",{categories});
});





router.get("/delete_category/:id",async function(req,res){
  var id = req.params.id;   
  var sql = `DELETE FROM categories WHERE category_id = ?`;
  var result = await exe(sql,[id]);
  res.redirect("/admin/category_list");
});

router.get("/add_crops",function(req,res){
  res.render("admin/add_crops.ejs");
});

router.post("/add_crop", async function (req, res) {
    var d = req.body;
    var filename = "";

    try {
      
        if (req.files && req.files.crop_image) {
            filename = new Date().getTime() + "_" + req.files.crop_image.name;
            await req.files.crop_image.mv("public/uploads/" + filename);
        }

        var sql = `
            INSERT INTO crops (
                crop_name_en, 
                crop_name_hi, 
                crop_name_mr, 
                crop_image
            ) VALUES (?, ?, ?, ?)
        `;
  var result = await exe(sql, [  d.crop_name_en, d.crop_name_hi,d.crop_name_mr,filename
        ]);

        console.log("Crop inserted successfully:", result);
        res.redirect("/admin/crops_list");

    } catch (err) {
        console.error("Error inserting crop:", err);
        res.status(500).send("Something went wrong!");
    }
});

router.get("/crops_list", async function (req, res) {
    try {
        var sql = `SELECT * FROM crops`;
        var crops = await exe(sql);
        res.render("admin/crops_list", { crops });
    } catch (err) {
        console.error("Error fetching crops:", err);
        res.status(500).send("Something went wrong!");
    }
});

router.get("/delete_crop", async function (req, res) {
    var id = req.params.id;
    try {
        var sql = `DELETE FROM crops WHERE crop_id = ?`;
        var result = await exe(sql, [id]);
        res.redirect("/admin/crops_list");
    } catch (err) {
        console.error("Error deleting crop:", err);
        res.status(500).send("Something went wrong!");
    }
});

router.get("/add_product", async (req, res) => {
  try {
    const lang = req.query.lang || "en";

    const categorySql = `
      SELECT 
        category_id,
        CASE
          WHEN ? = 'en' THEN category_name_en
          WHEN ? = 'hi' THEN category_name_hi
          WHEN ? = 'mr' THEN category_name_mr
          ELSE category_name_en
        END AS category_name
      FROM categories
    `;

    const brandSql = `
      SELECT 
        brand_id,
        CASE
          WHEN ? = 'en' THEN brand_name_en
          WHEN ? = 'hi' THEN brand_name_hi
          WHEN ? = 'mr' THEN brand_name_mr
          ELSE brand_name_en
        END AS brand_name
      FROM brands
    `;

    const cropSql = `
  SELECT 
    crop_id,
    CASE
      WHEN ? = 'en' THEN crop_name_en
      WHEN ? = 'hi' THEN crop_name_hi
      WHEN ? = 'mr' THEN crop_name_mr
      ELSE crop_name_en
    END AS crop_name
  FROM crops
`;

    const categories = await exe(categorySql, [lang, lang, lang]);
    const brands = await exe(brandSql, [lang, lang, lang]);
   const crops = await exe(cropSql, [lang, lang, lang]);

    res.render("admin/add_product", {
      lang,
      categories,
      brands,
      crops,
       translations
    });

  } catch (err) {
    console.log(err);
    res.send("Error loading form");
  }
});





router.post("/add_product", async (req, res) => {
  try {
    const {
      product_name,
      description,
      dosage,
      features,
      category_id,
      brand_id,
      season,
      stock_qty,
      discount,
      language,
    } = req.body;

    const seasonTranslated =
      translations[language] &&
      translations[language].season &&
      translations[language].season[season]
        ? translations[language].season[season]
        : season; 

    let main_image = null;
    if (req.files && req.files.productImage) {
      main_image = Date.now() + "_" + req.files.productImage.name;
      await req.files.productImage.mv("public/uploads/" + main_image);
    }

    const productResult = await exe(
      `INSERT INTO product
        (product_name, description, dosage, features, category_id, brand_id, season, main_image, stock_quantity, discount, language, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        product_name,
        description,
        dosage,
        features,
        category_id,
        brand_id,
        seasonTranslated,   
        main_image,
        stock_qty || 0,
        discount || 0,
        language,
      ]
    );

    const product_id = productResult.insertId;

    let crops = req.body["crops[]"] || req.body.crops;
    if (crops) {
      if (!Array.isArray(crops)) crops = [crops]; 
      for (let crop_id of crops) {
        await exe(
          `INSERT INTO product_crops (product_id, crop_id) VALUES (?, ?)`,
          [product_id, crop_id]
        );
      }
    }

 const weights = req.body["weight[]"];
const prices = req.body["price[]"];

// console.log("weights:", weights);
// console.log("prices:", prices);

    if (weights && prices) {
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] && prices[i]) {
          await exe(
            `INSERT INTO product_variants (product_id, weight, price) VALUES (?, ?, ?)`,
            [product_id, weights[i], prices[i]]
          );
        }
      }
    }

    // console.log(weights)
    // console.log(prices)

    res.redirect("/admin/add_product");
  } catch (error) {
    console.error("Error inserting product:", error);
    res.status(500).send("Error adding product");
  }
});




router.get("/product_list", async function (req, res) {
  try {
    const lang = req.query.lang || 'all';

    let sql = `
      SELECT 
        p.product_id,
        CASE 
          WHEN '${lang}' = 'en' THEN c.category_name_en
          WHEN '${lang}' = 'hi' THEN c.category_name_hi
          WHEN '${lang}' = 'mr' THEN c.category_name_mr
          ELSE c.category_name_en
        END as category_name,
        CASE 
          WHEN '${lang}' = 'en' THEN b.brand_name_en
          WHEN '${lang}' = 'hi' THEN b.brand_name_hi
          WHEN '${lang}' = 'mr' THEN b.brand_name_mr
          ELSE b.brand_name_en
        END as brand_name,
        p.product_name,
        p.stock_quantity,
        p.discount,
        p.description,
        p.dosage,
        p.features,
        p.season,
        p.language,
        p.main_image,
        GROUP_CONCAT(CONCAT(v.weight, ' - ₹', v.price) SEPARATOR ', ') as variants
      FROM product p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN product_variants v ON p.product_id = v.product_id
    `;

    let values = [];

    if (lang !== "all") {
      sql += " WHERE p.language = ?";
      values.push(lang);
    }

    sql += " GROUP BY p.product_id ORDER BY p.created_at DESC";

    const products = await exe(sql, values); 

    res.render("admin/product_list", { products, lang });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});







router.get("/product_edit/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const lang = req.query.lang || "en";

    // 1️⃣ Get product info
    const [productData] = await exe(
      "SELECT * FROM product WHERE product_id=?",
      [productId]
    );
    if (!productData) return res.status(404).send("Product not found");

    // 2️⃣ Get categories
    const categories = await exe(
      "SELECT category_id, CASE WHEN ?='en' THEN category_name_en WHEN ?='hi' THEN category_name_hi WHEN ?='mr' THEN category_name_mr ELSE category_name_en END as category_name FROM categories",
      [lang, lang, lang]
    );

    // 3️⃣ Get brands
    const brands = await exe(
      "SELECT brand_id, CASE WHEN ?='en' THEN brand_name_en WHEN ?='hi' THEN brand_name_hi WHEN ?='mr' THEN brand_name_mr ELSE brand_name_en END as brand_name FROM brands",
      [lang, lang, lang]
    );

    // 4️⃣ Get variants
    const variants = await exe(
      "SELECT * FROM product_variants WHERE product_id=?",
      [productId]
    );
// GET route
const crops = await exe(
  `SELECT crop_id,
    CASE 
      WHEN ?='en' THEN crop_name_en
      WHEN ?='hi' THEN crop_name_hi
      WHEN ?='mr' THEN crop_name_mr
      ELSE crop_name_en
    END as crop_name
   FROM crops`,
  [lang, lang, lang]
);

    // 6️⃣ Get selected crops for this product
    const selectedCrops = await exe(
      "SELECT crop_id FROM product_crops WHERE product_id=?",
      [productId]
    );
    const selectedCropIds = selectedCrops.map(c => c.crop_id);

    res.render("admin/product_edit", {
      product: productData,
      categories,
      brands,
      variants,
      crops,
      selectedCropIds,
      lang,
      translations // ensure you pass translations object for season dropdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


router.post("/product_update/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const data = req.body;

    // console.log("BODY:", data);
    // console.log("FILES:", req.files);

    await exe(
      `UPDATE product SET
         product_name = ?,
         category_id = ?,
         brand_id = ?,
         discount = ?,
         stock_quantity = ?,
         dosage = ?,
         season = ?,
         description = ?,
         features = ?,
         language = ?
       WHERE product_id = ?`,
      [
        data.product_name,
        data.category_id,
        data.brand_id,
        data.discount || 0,
        data.stock_qty,
        data.dosage,
        data.season,
        data.description,
        data.features,
        data.language,
        productId
      ]
    );

    if (req.files && req.files.productImage) {
      const file = req.files.productImage;
      const filename = Date.now() + "_" + file.name;
      await file.mv("public/uploads/" + filename);

      await exe(
        "UPDATE product SET main_image = ? WHERE product_id = ?",
        [filename, productId]
      );
    }

    const variantIds = Array.isArray(data['variant_id[]']) ? data['variant_id[]'] : (data['variant_id[]'] ? [data['variant_id[]']] : []);
const weights = Array.isArray(data['weight[]']) ? data['weight[]'] : (data['weight[]'] ? [data['weight[]']] : []);
const prices = Array.isArray(data['price[]']) ? data['price[]'] : (data['price[]'] ? [data['price[]']] : []);

    const existingVariants = await exe(
      "SELECT variant_id FROM product_variants WHERE product_id = ?",
      [productId]
    );
    const existingIds = existingVariants.map(v => v.variant_id);

    const idsToKeep = [];

    for (let i = 0; i < weights.length; i++) {
      if (variantIds[i]) {
        await exe(
          "UPDATE product_variants SET weight=?, price=? WHERE variant_id=?",
          [weights[i], prices[i], variantIds[i]]
        );
        idsToKeep.push(parseInt(variantIds[i]));
      } else {
        if (weights[i] && prices[i]) {
          const result = await exe(
            "INSERT INTO product_variants (product_id, weight, price) VALUES (?, ?, ?)",
            [productId, weights[i], prices[i]]
          );
          idsToKeep.push(result.insertId);
        }
      }
    }

    const idsToDelete = existingIds.filter(id => !idsToKeep.includes(id));
    if (idsToDelete.length > 0) {
      await exe(
        `DELETE FROM product_variants WHERE variant_id IN (${idsToDelete.join(",")})`
      );
    }

    await exe("DELETE FROM product_crops WHERE product_id = ?", [productId]);
   if (data['crops[]']) {
  const crops = Array.isArray(data['crops[]']) ? data['crops[]'] : [data['crops[]']];
  for (let cropId of crops) {
    await exe(
      "INSERT INTO product_crops (product_id, crop_id) VALUES (?, ?)",
      [productId, cropId]
    );
  }
}
    res.redirect("/admin/product_list?lang=" + data.language);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});



router.get("/product_delete/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    await exe("DELETE FROM product_variants WHERE product_id = ?", [productId]);

    await exe("DELETE FROM products WHERE product_id = ?", [productId]);

    res.redirect("/admin/product_list");
  } catch (err) {
    console.error("❌ Error deleting product:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/company_info",async function(req,res){
  var sql = `SELECT * FROM company_info`;
  var records = await exe(sql);
  res.render("admin/company_info.ejs",{records})
})


router.get("/contact_info/:id",async function(req,res){
  var id =  req.params.id;
  var sql = `SELECT * FROM company_info WHERE id = ?`;
  var records = await exe(sql,[id]);
  res.render("admin/edit_company_info.ejs",{records})
})

router.post("/update_company_info/:id",async function(req,res){
  var id = req.params.id;
  var d = req.body;

var sql =` UPDATE company_info 
SET 
    shop_name = ?, 
    shop_address_line1 = ?, 
    shop_address_line2 = ?, 
    city = ?, 
    state = ?, 
    country = ?, 
    pincode = ?, 
    phone_main = ?, 
    phone_emergency = ?, 
    email_general = ?, 
    email_support = ?, 
    hours_weekdays = ?, 
    hours_sunday = ?, 
    open_holidays = ?
WHERE id = ?;`;
var result = await exe(sql,[d.shop_name,d.shop_address_line1,
  d.shop_address_line2,d.city,d.state,d.country,d.pincode,d.phone_main,
  d.phone_emergency,d.email_general,d.email_support,d.hours_weekdays,
  d.hours_sunday,d.open_holidays,id]);
  res.send(result);
})

router.get('/recomendation', async (req, res) => {
  res.render('admin/recomendation', { translations });
});

router.post('/recommendations/add', async (req, res) => {
  try {
    const d = req.body;
    let filename = '';

    if (req.files && req.files.image) {
      filename = Date.now() + '_' + req.files.image.name;
      await req.files.image.mv('public/uploads/' + filename);
    }

    await exe(`
      INSERT INTO recommendations 
      (name, type, crop_name, season, soil_type, stage, product_usage, language, image) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.name, d.type, d.crop_name, d.season, d.soil_type, d.stage, d.product_usage, d.language, filename]
    );

    res.redirect('/admin/recomendation');
  } catch (err) {
    console.error("Error adding recommendation:", err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/recomendation_list', async (req, res) => {
  try {
    const langFilter = req.query.language || ''; 
    let sql = 'SELECT * FROM recommendations';
    const params = [];

    if (langFilter) {
      sql += ' WHERE language = ?';
      params.push(langFilter);
    }

    sql += ' ORDER BY rec_id DESC';

    const recommendations = await exe(sql, params);
    res.render('admin/recomendation_list', { recommendations, selectedLang: langFilter });
  } catch (err) {
    console.error("Error fetching recommendations:", err);
    res.status(500).send("Internal Server Error");
  }
});

// GET Edit form
router.get('/recommendations_edit/:id', async (req, res) => {
  try {
    const recId = req.params.id;
    const recommendations = await exe('SELECT * FROM recommendations WHERE rec_id = ?', [recId]);
    if (recommendations.length === 0) {
      return res.status(404).send('Recommendation not found');
    }
    const recommendation = recommendations[0];
    res.render('admin/recommendations_edit', { recommendation, translations });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// POST Update
router.post('/recommendations_edit/:id', async (req, res) => {
  try {
    const recId = req.params.id;
    const d = req.body;
    let filename = d.old_image || '';

    // Image update
    if (req.files && req.files.image) {
      filename = Date.now() + '_' + req.files.image.name;
      await req.files.image.mv('public/uploads/' + filename);
    }

    await exe(`
      UPDATE recommendations SET
      name = ?, type = ?, crop_name = ?, season = ?, soil_type = ?, stage = ?,
      product_usage = ?, language = ?, image = ?
      WHERE rec_id = ?`,
      [d.name, d.type, d.crop_name, d.season, d.soil_type, d.stage, d.product_usage, d.language, filename, recId]
    );

    res.redirect('/admin/recomendation_list');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/recommendations_delete/:id', async (req, res) => {
  try {
    const recId = req.params.id;
    await exe('DELETE FROM recommendations WHERE rec_id = ?', [recId]);
    res.redirect('/admin/recomendation_list');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
























router.get("/soil_testing_report",function(req,res){
  res.render("admin/soil_testing.ejs")
})




module.exports = router;