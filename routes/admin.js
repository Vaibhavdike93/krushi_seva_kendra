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

<<<<<<< Updated upstream
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

router.get("/add_product", async function(req, res) {
  try {
    const lang = req.query.lang || 'en';

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

    const cropsSql = `
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
    const crops = await exe(cropsSql, [lang, lang, lang]);

    res.render("admin/add_product", {
      category: categories,
      brands: brands,
      crops: crops,
      lang: lang
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.post("/add_product", async function(req, res) {
  try {
    let filename = "";

    if (req.files && req.files.productImage) {
      filename = Date.now() + "_" + req.files.productImage.name;
      await req.files.productImage.mv("public/uploads/" + filename);
    }

    const d = req.body;
    const lang = d.language;

    let crops = d['crops[]'];
    if (Array.isArray(crops)) {
      crops = crops.join(",");
    } else if (!crops) {
      crops = "";
    }

    const productNameCol = `product_name_${lang}`;
    const descriptionCol = `description_${lang}`;
    const dosageCol = `dosage_${lang}`;
    const featuresCol = `features_${lang}`;

    const insertProductSql = `
  INSERT INTO products (
    category_id,
    brand_id,
    discount,
    stock_qty,
    season,
    crops,
    product_image,
    created_at,
    updated_at,
    language,
    ${productNameCol},
    ${descriptionCol},
    ${dosageCol},
    ${featuresCol}
  ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?)
`;

const productValues = [
  d.category_id,
  d.brand_id,
  d.discount || 0,
  d.stock_qty || 0, 
  d.season,
  crops,
  filename,
  lang,
  d.productName,
  d.description,
  d.dosage,
  d.features
];


    const result = await exe(insertProductSql, productValues);
    const productId = result.insertId;
    console.log("Inserted product ID:", productId);

    const weights = Array.isArray(d['weight[]']) ? d['weight[]'] : [d['weight[]']];
    const prices = Array.isArray(d['variant_price[]']) ? d['variant_price[]'] : [d['variant_price[]']];

    console.log("Weights:", weights);
    console.log("Prices:", prices);

    for (let i = 0; i < weights.length; i++) {
      if (weights[i] && prices[i]) {
        try {
          const insertVariantSql = `
            INSERT INTO product_variants (product_id, weight, price)
            VALUES (?, ?, ?)
          `;
          await exe(insertVariantSql, [productId, weights[i], prices[i]]);
          console.log(`Inserted variant: weight=${weights[i]}, price=${prices[i]}`);
        } catch (variantErr) {
          console.error("Variant insert error:", variantErr);
        }
      } else {
        console.log(`Skipping variant at index ${i} due to missing weight or price`);
      }
    }

    res.redirect("/admin/product_list");
  } catch (err) {
    console.error("Error inserting product and variants:", err);
    res.status(500).send("Something went wrong!");
  }
});

router.get("/product_list", async (req, res) => {
  try {
    const lang = req.query.lang || 'en';

    let productNameCol, catNameCol, brandNameCol, cropNameCol;

    if (lang === 'all') {
      // सर्व language columns घेणार
      productNameCol = "CONCAT_WS(' / ', product_name_en, product_name_mr, product_name_hi) AS product_name";
      catNameCol = "CONCAT_WS(' / ', c.category_name_en, c.category_name_mr, c.category_name_hi) AS category_name";
      brandNameCol = "CONCAT_WS(' / ', b.brand_name_en, b.brand_name_mr, b.brand_name_hi) AS brand_name";
      cropNameCol = "CONCAT_WS(' / ', crop_name_en, crop_name_mr, crop_name_hi) AS crop_name";
    } else {
      // language-wise column
      productNameCol = `p.product_name_${lang} AS product_name`;
      catNameCol = `c.category_name_${lang} AS category_name`;
      brandNameCol = `b.brand_name_${lang} AS brand_name`;
      cropNameCol = `crop_name_${lang} AS crop_name`;
    }

    const productsQuery = `
      SELECT p.*, ${productNameCol}, ${catNameCol}, ${brandNameCol}
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN brands b ON p.brand_id = b.brand_id
      ORDER BY p.product_id DESC
    `;
    const products = await exe(productsQuery);

    const productIds = products.map(p => p.product_id);
    let variantsByProduct = {};
    if (productIds.length > 0) {
      const variants = await exe(`SELECT * FROM product_variants WHERE product_id IN (?)`, [productIds]);
      variants.forEach(v => {
        if (!variantsByProduct[v.product_id]) variantsByProduct[v.product_id] = [];
        variantsByProduct[v.product_id].push(v);
      });
    }

    const cropsData = await exe(`SELECT crop_id, ${cropNameCol} FROM crops`);
    const cropMap = {};
    cropsData.forEach(c => cropMap[c.crop_id] = c.crop_name);

    products.forEach(product => {
      if (product.crops) {
        const cropIds = product.crops.split(",").map(id => id.trim());
        const cropNames = cropIds.map(id => cropMap[id]).filter(Boolean);
        product.crops = cropNames.join(", ");
      } else {
        product.crops = "";
      }
    });

    res.render("admin/product_list", {
      products,
      variantsByProduct,
      lang
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


router.get("/product_edit/:id", async (req, res) => {
  try {
    const productId = req.params.id;

  const [product] = await exe(
  `SELECT 
    product_id,
    product_name_en,
    product_name_hi,
    product_name_mr,
    description_en,
    description_hi,
    description_mr,
    dosage_en,
    dosage_hi,
    dosage_mr,
    features_en,
    features_hi,
    features_mr,
    category_id,
    brand_id,
    price,
    discount,
    stock_qty,
    season,
    crops,
    product_image,
    created_at,
    updated_at,
    language
  FROM products
  WHERE product_id = ?`,
  [productId]
);


    if (!product) {
      return res.status(404).send("❌ Product not found");
    }

    const lang = product.language || "en"; 

    const selectedCrops = product.crops
      ? product.crops.split(",").map(id => id.trim())
      : [];

    const categories = await exe(`
      SELECT category_id, category_name_en, category_name_hi, category_name_mr, category_image
      FROM categories
    `);

    const brands = await exe(`
      SELECT brand_id, brand_name_en, brand_name_hi, brand_name_mr, brand_image
      FROM brands
    `);

    const cropsList = await exe(`
      SELECT crop_id, crop_name_en, crop_name_mr, crop_name_hi
      FROM crops
    `);

    const variants = await exe(
      `SELECT variant_id, weight, price
       FROM product_variants
       WHERE product_id = ?`,
      [productId]
    );

    res.render("admin/product_edit", {
      product,
      categories,
      brands,
      cropsList,
      variants,
      selectedCrops,
      lang
    });

  } catch (err) {
    console.error("❌ Error fetching product:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/product_update/:id", async (req, res) => {
  try {
    const d = req.body;
    const productId = req.params.id;

    const [oldProduct] = await exe(`SELECT language, product_image FROM products WHERE product_id = ?`, [productId]);
    const lang = oldProduct.language || "en";

    let filename = oldProduct.product_image;

    if (req.files && req.files.product_image) {
      filename = new Date().getTime() + "_" + req.files.product_image.name;
      await req.files.product_image.mv("public/uploads/" + filename);
    }

   const sql = `
  UPDATE products SET
    product_name_${lang} = ?,
    description_${lang} = ?,
    dosage_${lang} = ?,
    features_${lang} = ?,
    category_id = ?,
    brand_id = ?,
    season = ?,
    crops = ?,
    discount = ?,  
    stock_qty = ?,             
    product_image = ?,
    updated_at = NOW()
  WHERE product_id = ?
`;

await exe(sql, [
  d[`product_name_${lang}`],
  d[`description_${lang}`],
  d[`dosage_${lang}`],
  d[`features_${lang}`],
  d.category_id,
  d.brand_id,
  d.season,
  Array.isArray(d['crops[]']) ? d['crops[]'].join(",") : (d['crops[]'] || ""),
  d.discount || 0,
  d.stock_qty || 0,     
  filename,
  productId
]);


 const weights = d.weight || [];
const prices = d.variant_price || [];



const weightArray = Array.isArray(weights) ? weights.filter(w => w.trim() !== '') : (weights.trim() !== '' ? [weights.trim()] : []);
const priceArray = Array.isArray(prices) ? prices.filter(p => p !== '') : (prices !== '' ? [prices] : []);


if (weightArray.length !== priceArray.length) {
  throw new Error("Each weight must have a matching price");
}

await exe("DELETE FROM product_variants WHERE product_id = ?", [productId]);

for (let i = 0; i < weightArray.length; i++) {
  const weight = weightArray[i];
  const price = parseFloat(priceArray[i]);

  if (!weight || isNaN(price)) {
    console.warn(`Skipping invalid variant at index ${i}: weight=${weight}, price=${priceArray[i]}`);
    continue;
  }

  await exe(
    "INSERT INTO product_variants (product_id, weight, price) VALUES (?, ?, ?)",
    [productId, weight, price]
  );
}

console.log(req.body);
    res.redirect("/admin/product_list");
  } catch (err) {
    console.error("❌ Error updating product:", err);
    res.status(500).send("Internal Server Error");
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
=======
router.get("/soil_testing_report",function(req,res){
  res.render("admin/soil_testing.ejs")
>>>>>>> Stashed changes
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