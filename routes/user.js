var express = require('express');
var exe = require('./conn');
var router = express.Router();
var translations = require("../translation");
var nodemailer = require('nodemailer');

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
          p.main_image,  
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
   let cartItems = [];
let cartProductIds = [];
if (req.session.user && req.session.user.user_id) {
  cartItems = await exe("SELECT * FROM shopping_cart WHERE user_id = ?", [req.session.user.user_id]);
  cartProductIds = cartItems.map(item => item.product_id); 
}
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
      totalProducts,
      cartItems,
      cartProductIds
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

     exe(`SELECT product_id FROM cart WHERE user_id = ?`, [userId], (err, cartRows) => {
            if (err) return res.status(500).json({ error: "Cart fetch error" });

            let cartProductIds = cartRows.map(c => c.product_id);
            res.json({ products: Object.values(products), cartProductIds });
        });


    res.json(Object.values(products));
});


});

router.get("/product_details/:id", async (req, res) => {
  try {
    const lang = req.session.lang || 'en';
    const id = req.params.id;
const userId = req.session.user?.user_id || null;
    const productQuery = `
      SELECT p.*, 
             c.category_name_en, c.category_name_hi, c.category_name_mr,
             b.brand_name_en, b.brand_name_hi, b.brand_name_mr,
             v.variant_id, v.weight, v.price AS original_price
      FROM product p
      LEFT JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN brands b ON p.brand_id = b.brand_id
      LEFT JOIN product_variants v ON p.product_id = v.product_id
      WHERE p.product_id = ? AND p.language = ?
      ORDER BY v.variant_id ASC
    `;
    const rows = await exe(productQuery, [id, lang]);

    if (!rows || rows.length === 0) return res.status(404).send("Product not found");

    const product = {
      ...rows[0],
      variants: rows.map(v => ({
        variant_id: v.variant_id,
        weight: v.weight,
        original_price: v.original_price,
        final_price: v.original_price - (v.original_price * rows[0].discount / 100),
        discount_amount: (v.original_price * rows[0].discount / 100)
      }))
    };

    product.selectedVariant = product.variants[0];

    product.dosage = product.dosage.split('|');      
    product.features = product.features.split('|'); 
    
     let alreadyInCart = false;
    if (userId) {
      const cartCheck = await exe(
        "SELECT * FROM shopping_cart WHERE user_id=? AND product_id=? AND variant_id=?",
        [userId, id, product.selectedVariant.variant_id]
      );
      if (cartCheck.length > 0) alreadyInCart = true;
    }

    res.render("user/product_details", { product, lang, search: req.query.search || '', alreadyInCart });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading product details");
  }
});









router.post("/add_tocart", async (req, res) => {
    try {
        const userId = req.session.user?.user_id;
        if (!userId) return res.redirect("/login");

        const { product_id, variant_id } = req.body;
        const lang = req.session.lang || "en";

        if (!variant_id) {
            return res.send("Please select a variant");
        }

        // ✅ Variant check
        const variantRows = await exe(
            "SELECT variant_id, price, weight FROM product_variants WHERE variant_id = ? AND product_id = ?",
            [variant_id, product_id]
        );
        if (!variantRows.length) return res.send("Variant not found");

        const variant = variantRows[0];

        // ✅ Product check
        const productRows = await exe(
            "SELECT discount, brand_id, product_name FROM product WHERE product_id = ?",
            [product_id]
        );
        if (!productRows.length) return res.send("Product not found");

        // ✅ Discount calculation
        const discountPercent = productRows[0]?.discount || 0;
        const discountAmount = (variant.price * discountPercent) / 100;
        const finalPrice = variant.price - discountAmount;

        // ✅ Check existing cart item
        const cartRowsCheck = await exe(
            "SELECT * FROM shopping_cart WHERE user_id = ? AND product_id = ? AND variant_id = ?",
            [userId, product_id, variant_id]
        );

        if (cartRowsCheck.length > 0) {
            // 🔄 Update quantity
            const oldQty = cartRowsCheck[0].quantity;
            const newQty = oldQty + 1;
            const totalPrice = newQty * finalPrice;

            await exe(
                "UPDATE shopping_cart SET quantity = ?, price = ?, total_price = ? WHERE cart_id = ?",
                [newQty, finalPrice, totalPrice, cartRowsCheck[0].cart_id]
            );
        } else {
            // ➕ Insert new cart item
            const totalPrice = finalPrice * 1;
            await exe(
                "INSERT INTO shopping_cart (user_id, product_id, variant_id, quantity, price, total_price, language) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [userId, product_id, variant_id, 1, finalPrice, totalPrice, lang]
            );
        }

        res.redirect("/add_tocart?lang=" + lang);

    } catch (err) {
        console.error("❌ Error in add_tocart:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


router.get("/add_tocart", async (req, res) => {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) {
      return res.redirect("/login");
    }
    const lang = req.session.lang || "en";

    const cartItems = await exe(`
      SELECT sc.*, p.product_name, p.main_image, p.discount, 
             b.brand_name_en AS brand_name, 
             v.weight, v.price
      FROM shopping_cart sc
      LEFT JOIN product p ON sc.product_id = p.product_id
      LEFT JOIN product_variants v ON sc.variant_id = v.variant_id
      LEFT JOIN brands b ON p.brand_id = b.brand_id
      WHERE sc.user_id = ? AND sc.language = ?
    `, [userId, lang]);

    let total = 0;
    let originalTotal = 0;

    cartItems.forEach(item => {
      let qty = item.quantity || 1;

      let originalPrice = item.price;

      let discountedPrice = item.price;
      if (item.discount && item.discount > 0) {
        discountedPrice = item.price - (item.price * item.discount / 100);
      }

      total += discountedPrice * qty;
      originalTotal += originalPrice * qty;

      item.originalPrice = originalPrice;
      item.discountedPrice = discountedPrice;
    });

    let net = total;
    let youSaved = originalTotal - total;

    res.render("user/add_tocart", { 
      cartItems, 
      totalPrice: total.toFixed(2), 
      net: net.toFixed(2),
      youSaved: youSaved.toFixed(2),
      lang,
      search: req.query.search || '' 
    });
  } catch (err) {
    console.error("❌ Error in add_tocart:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/update_cart_qty", async (req, res) => {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    const { cart_id, quantity } = req.body;
    if (!cart_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: "Invalid data" });
    }

    await exe(`UPDATE shopping_cart SET quantity = ? WHERE cart_id = ? AND user_id = ?`,
              [quantity, cart_id, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ update_cart_qty error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


router.get("/remove_cart/:cartId", async (req, res) => {
    try { 
      var id =req.params.cartId;
      var sql = await exe("DELETE FROM shopping_cart WHERE cart_id = ?",[id]);
      res.redirect("/add_tocart");
    } catch(err){
      console.error("Error remove cart");
      res.status(500).json({success:false,message:"Server Error"});
    }
  })

router.get("/checkout", async function(req, res) {
  var userId = req.session.user?.user_id;
  if (!userId) {
      return res.redirect("/login");
  }

  try {
    const cartItems = await exe(
      `SELECT c.cart_id, c.quantity,c.product_id,
              p.product_name, p.discount, p.main_image,
              v.weight, v.price AS originalPrice
       FROM shopping_cart c
       JOIN product p ON c.product_id = p.product_id
       JOIN product_variants v ON c.variant_id = v.variant_id
       WHERE c.user_id = ? AND c.language = ?`, 
      [userId, req.session.lang || "en"]
    );

    let total = 0, originalTotal = 0;

    cartItems.forEach(item => {
      let discountedPrice = item.originalPrice;
      if (item.discount && item.discount > 0) {
        discountedPrice = item.originalPrice - (item.originalPrice * item.discount / 100);
      }

      item.discountedPrice = discountedPrice;
      item.saved = (item.originalPrice - discountedPrice) * item.quantity;

      total += discountedPrice * item.quantity;
      originalTotal += item.originalPrice * item.quantity;
    });

    const youSaved = originalTotal - total;
res.render("user/checkout", {
  cartItems,
  total,        
  youSaved,
  net: total,
  search: req.query.search || ''
});

  } catch (err) {
    console.error("❌ Checkout Error:", err);
    res.redirect("/cart");
  }
});





router.post("/checkout", async function (req, res) {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const {
      name,
      email,
      phone,
      pincode,
      village,
      taluka,
      district,
      state,
      landmark,
      payment,
      products,
      orderTotal,
      orderSaved
    } = req.body;

    const language = req.session.lang || "en";

    const orderResult = await exe(
      `INSERT INTO orders 
        (user_id, name, email, phone, pincode, village, taluka, district, state, landmark, payment_mode, language, order_total, order_saved) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, name, email, phone, pincode, village, taluka, district, state,
        landmark, payment, language, orderTotal, orderSaved
      ]
    );

    const orderId = orderResult.insertId;

    for (let product of products) {
      await exe(
        `INSERT INTO order_products (order_id, product_id, product_name, weight, quantity, price, saved) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          product.product_id || null,
          product.product_name,
          product.weight,
          product.quantity,
          product.price,
          product.saved
        ]
      );
    }

    await exe(`DELETE FROM shopping_cart WHERE user_id = ?`, [userId]);

    const mailOptions = {
      from: "yourmail@gmail.com",
      to: email, 
      subject: "Order Successful - Your Order #" + orderId,
      html: `
        <h2>Thank you for your order, ${name}!</h2>
        <p>Your order has been placed successfully.</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Order Total:</strong> ₹${orderTotal}</p>
        <h3>Products:</h3>
        <ul>
          ${products.map(p => `<li>${p.product_name} (${p.weight}) - Qty: ${p.quantity} - ₹${p.price}</li>`).join("")}
        </ul>
        <p>We will contact you shortly regarding delivery.</p>
      `
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Email error:", error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });

    if (payment === "cod") {
      return res.redirect("/thankyou");
    } else if (payment === "netbanking") {
      return res.redirect("/payment?order_id=" + orderId);
    } else {
      return res.status(400).send("Invalid payment method");
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

module.exports = router;









router.get("/thankyou/", function(req, res) {
  res.render("user/thankyou", { search: req.query.search || '' });
  // res.send(req.body);
  // res.render("user/thankyou", { search: req.query.search || '' });
  });























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

    res.render("user/category", { products: finalProducts, lang, search: req.query.search || '' });
  });
});













module.exports = router;