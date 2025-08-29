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

router.get('/profile',async function(req, res) {
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
    res.redirect(`/login?lang=${lang}`); 
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});




router.get('/', async function(req, res) {
    try {
        if(req.query.lang){
            req.session.language = req.query.lang; 
        }
        var lang = req.session.language || "en";
        var userId = req.session.user ? req.session.user.user_id : null;

        var categories = await exe("SELECT * FROM categories");
        const search = req.query.search || "";

        var popularProducts = await exe(`
            SELECT 
                p.product_id,
                p.product_name,
                p.main_image,
                p.discount,
                v.variant_id,
                v.weight,
                v.price AS original_price,
                ROUND(v.price - (v.price * p.discount / 100)) AS discount_price,
                (v.price - ROUND(v.price - (v.price * p.discount / 100))) AS you_save,
                COUNT(op.product_id) AS order_total
            FROM order_products op
            JOIN product p 
                ON op.product_id = p.product_id
            JOIN product_variants v 
                ON v.product_id = p.product_id
            WHERE v.variant_id = (
                SELECT MIN(variant_id) 
                FROM product_variants 
                WHERE product_id = p.product_id
            )
            AND p.language = ?
            GROUP BY p.product_id, p.product_name, p.main_image, v.variant_id, v.weight, v.price, p.discount
            ORDER BY order_total DESC
            LIMIT 8;
        `, [lang]);

        let wishlistMap = {};  
if(userId){
    const wishlistRows = await exe("SELECT wishlist_id, product_id FROM wishlist WHERE user_id = ?", [userId]);
    wishlistRows.forEach(row => {
        wishlistMap[row.product_id] = row.wishlist_id;
    });
}

popularProducts = popularProducts.map(p => {
    return {
        ...p,
        inWishlist: wishlistMap[p.product_id] ? true : false,
        wishlist_id: wishlistMap[p.product_id] || null
    };
});

        res.render('user/index', {
            categories: categories,
            lang: lang,
            translations: translations[lang],
            search,
            popularProducts
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
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

    // Count query
    let countSql = `
      SELECT COUNT(DISTINCT p.product_id) as total
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

    // Main query with GROUP BY
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
        (v.price - (v.price * p.discount / 100)) AS final_price,
        w.wishlist_id,
        CASE WHEN w.wishlist_id IS NOT NULL THEN 1 ELSE 0 END AS inWishlist,
        IFNULL(ROUND(AVG(r.rating),1),0) AS avg_rating,
        COUNT(r.review_id) AS total_reviews
      FROM product p
      JOIN categories c ON p.category_id = c.category_id
      JOIN brands b ON p.brand_id = b.brand_id
      JOIN product_variants v ON p.product_id = v.product_id
      LEFT JOIN wishlist w ON w.product_id = p.product_id AND w.user_id = ?
      LEFT JOIN product_reviews r ON r.product_id = p.product_id
      WHERE p.language = ?
    `;
    const params = [req.session.user ? req.session.user.user_id : 0, lang];

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
      GROUP BY p.product_id
      ORDER BY p.product_id DESC
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
    const { categories, brands } = req.body;   
    const lang = req.session.lang || "en";
    const userId = req.session.user ? req.session.user.user_id : null;

    const categoryCol =
        lang === 'mr' ? 'c.category_name_mr' :
        lang === 'hi' ? 'c.category_name_hi' :
        'c.category_name_en';

    const brandCol =
        lang === 'mr' ? 'b.brand_name_mr' :
        lang === 'hi' ? 'b.brand_name_hi' :
        'b.brand_name_en';

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

        if (userId) {
            exe(`SELECT product_id FROM cart WHERE user_id = ?`, [userId], (err, cartRows) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: "Cart fetch error" });
                }

                let cartProductIds = cartRows.map(c => c.product_id);
                return res.json({ products: Object.values(products), cartProductIds });
            });
        } else {
            return res.json({ products: Object.values(products), cartProductIds: [] });
        }
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

    var review = await exe("SELECT * FROM product_reviews WHERE product_id =? AND language =? LIMIT 5 ",[id,lang])
// console.log(review);
    res.render("user/product_details", { product, lang, search: req.query.search || '', alreadyInCart ,review});
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
console.log(cartItems);
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


router.get("/place_order", async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const {
      razorpay_payment_id,
      name,
      phone,
      email,
      pincode,
      state,
      city,
      district,
      landmark,
      address,
      amount,
      products,
      orderSaved,
      payment_method,
    } = req.query;

    if (!name || !phone || !amount || !products) {
      return res.status(400).send("Missing required fields");
    }

    let parsedProducts = [];
    try {
      parsedProducts = JSON.parse(products);
    } catch (err) {
      console.error(err);
      return res.status(400).send("Invalid product data");
    }

    const orderQuery = `
      INSERT INTO orders 
      (user_id, name, phone, email, pincode, state, taluka, district, landmark, village, payment_id, payment_method, order_total, order_saved, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const orderResult = await exe(orderQuery, [
      userId,
      name,
      phone,
      email,
      pincode,
      state,
      city,
      district,
      landmark,
      address,
      razorpay_payment_id,
      payment_method,
      amount,
      orderSaved || 0,
      moment().format("YYYY-MM-DD HH:mm:ss"),
    ]);

    const orderId = orderResult.insertId;

    const productQuery = `
      INSERT INTO order_products (order_id, product_id, product_name, weight, quantity, price, originalPrice, saved)
      VALUES ?
    `;
    const productValues = parsedProducts.map((p) => [
      orderId,
      p.product_id,
      p.product_name,
      p.weight,
      p.quantity,
      p.price,
      p.originalPrice,
      p.saved,
    ]);
    await exe(productQuery, [productValues]);

    await exe("DELETE FROM shopping_cart WHERE user_id = ?", [userId]);

    const productListHtml = parsedProducts
      .map(
        (p) =>
          `<li>${p.product_name} (${p.weight}) - Qty: ${p.quantity} - ₹${p.price}</li>`
      )
      .join("");

    const mailOptions = {
      from: '"Krushi Seva Kendra" <your_email@gmail.com>',
      to: email,
      subject: `Order Confirmation - #${orderId}`,
      html: `
        <h2>Thank you for your order!</h2>
        <p>Hi <b>${name}</b>,</p>
        <p>Your order has been placed successfully.</p>
        <p><b>Order ID:</b> ${orderId}</p>
        <p><b>Payment Method:</b> ${payment_method}</p>
        <p><b>Total Amount:</b> ₹${amount}</p>
        <h3>Products:</h3>
        <ul>
          ${productListHtml}
        </ul>
        <p>We will notify you once your order is shipped.</p>
        <br/>
        <p>Regards,<br/>Janmitra Krushi Seva Kendra</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email error:", error);
      } else {
        console.log("Email sent:", info.response);
      }
    });

    res.redirect(`/thankyou?order_id=${orderId}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Something went wrong while placing order");
  }
});



router.post("/create-order", async (req, res) => {
  try {
    const { amount } = req.body; 

    const options = {
      amount: amount * 100, 
      currency: "INR",
      receipt: "order_rcptid_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error("Razorpay order create error:", err);
    res.status(500).json({ success: false, error: "Something went wrong" });
  }
});



router.post("/submit_review", async (req, res) => {
  try {
    const userId = req.session.user?.user_id;
    const lang = req.session.lang || "en";
    if (!userId) {
      res.redirect("/login");
      return res.status(401).json({ success: false, message: "Login required" });
    }
    var sql = `INSERT INTO product_reviews (user_id,name, product_id, rating, review,language, created_at) VALUES (?, ?, ?, ?,?,?, NOW())`;
    await exe(sql, [userId,req.body.name, req.body.product_id, req.body.rating, req.body.review,lang]);
res.redirect(`/product/?lang=${lang}`);
  }

  catch (err) {
    console.error("❌ submit_review error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});







router.get("/thankyou/", function(req, res) {
  res.render("user/thankyou", { search: req.query.search || '' });
  // res.send(req.body);
  // res.render("user/thankyou", { search: req.query.search || '' });
  });
router.get("/wishlist/:product_id", async function (req, res) {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) return res.redirect("/login");

    const productId = parseInt(req.params.product_id, 10);
    if (isNaN(productId)) return res.status(400).send("Invalid product ID");

    const lang = req.query.lang || req.session.language || "en";
    req.session.language = lang;

    const check = await exe(
      "SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?",
      [userId, productId]
    );

    if (check.length > 0) {
      await exe("DELETE FROM wishlist WHERE user_id = ? AND product_id = ?", [
        userId,
        productId,
      ]);
    } else {
      await exe("INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)", [
        userId,
        productId,
      ]);
    }

    res.redirect(`/product?lang=${lang}`);   // 🔑 language preserved
  } catch (err) {
    console.error(err);
    res.send("Error in wishlist");
  }
});

router.get("/wishlist", async function (req, res) {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) {
      return res.redirect("/login");
    }

    const wishlistItems = await exe(
      `SELECT 
    w.wishlist_id,
    p.product_id,
    p.product_name,
    p.main_image,
    p.discount,
    v.variant_id,
    v.weight,
    v.price AS original_price,
    (v.price - (v.price * p.discount / 100)) AS final_price,
    (v.price * p.discount / 100) AS save_amount,
    c.cart_id
FROM wishlist w
JOIN product p ON w.product_id = p.product_id
JOIN product_variants v 
    ON v.product_id = p.product_id 
   AND v.price = (
        SELECT MIN(price) 
        FROM product_variants 
        WHERE product_id = p.product_id
    )
LEFT JOIN shopping_cart c ON c.product_id = p.product_id AND c.user_id = w.user_id
WHERE w.user_id = ?
ORDER BY w.created_at DESC;
`,
      [userId]
    );

    res.render("user/wishlist", { wishlistItems, lang: req.session.language || "en" ,  search: req.query.search || ''});
  } catch (err) {
    console.error(err);
    res.send("Error loading wishlist");
  }
});
router.get("/remove_wishlist/:id", async function (req, res) {
  try {
    const userId = req.session.user?.user_id;
    if (!userId) return res.redirect("/login");

    const wishlistId = parseInt(req.params.id, 10);
    if (isNaN(wishlistId)) return res.status(400).send("Invalid wishlist ID");

    const lang = req.query.lang || req.session.language || "en";
    req.session.language = lang;

    await exe("DELETE FROM wishlist WHERE wishlist_id = ? AND user_id = ?", [
      wishlistId,
      userId,
    ]);

    res.redirect(`/product?lang=${lang}`);   
  } catch (err) {
    console.error(err);
    res.send("Error removing from wishlist");
  }
});


router.get("/orders", async function (req, res) {
  var userId = req.session.user.user_id;
  var lang = req.session.lang || "en";
  var orderSearch = req.query.q || "";

  let query = `
    SELECT orders.*, order_products.*, product.*
    FROM orders
    LEFT JOIN order_products ON order_products.order_id = orders.order_id
    LEFT JOIN product ON product.product_id = order_products.product_id
    WHERE orders.user_id = ? AND orders.language = ?
  `;

  let params = [userId, lang];

  if (orderSearch) {
    query += ` AND (orders.order_id LIKE ? OR product.product_name LIKE ? OR orders.status LIKE ?)`;
    params.push(`%${orderSearch}%`, `%${orderSearch}%`, `%${orderSearch}%`);
  }

  const order = await exe(query, params);

  res.render("user/orders.ejs", { orderSearch, order ,search:req.query.search || ""});
});


router.get("/canceled_order/:id",async function(req,res){
  var id = req.params.id;
  var sql = await exe("UPDATE orders SET status = 'Cancelled',cancelled_at = NOW() WHERE order_id = ?",[id]);
  res.send(sql);
  // redirect("/orders");
})

router.get("/order_details/:id",async function(req,res){
  var id = req.params.id;
  var lang = req.session.lang;
  var userId = req.session.user.user_id;

  var sql = await exe(`SELECT * FROM orders 
    LEFT JOIN order_products ON order_products.order_id = orders.order_id 
    LEFT JOIN product ON product.product_id = order_products.product_id
    WHERE  orders.order_id = ? AND orders.user_id = ? AND orders.language = ?
    `,[id,userId,lang]);
    console.log(sql);
  res.render("user/order_details.ejs",{search:req.query.search || "",order:sql[0]});
});





router.get("/download_invoice/:id", async function (req, res) {
  try {
    var id = req.params.id;

    const orderResult = await exe(
      `SELECT o.order_id, o.name, o.email, o.order_total, o.village, o.taluka, o.district, o.phone, o.payment_id, o.payment_method, o.created_at 
       FROM orders o 
       WHERE o.order_id = ?`,
      [id]
    );

    let products = await exe(
      `SELECT op.product_name, op.quantity, op.price, op.weight
       FROM order_products op 
       WHERE op.order_id = ?`,
      [id]
    );

    products = products.map(p => {
      return {
        ...p,
        total: p.quantity * p.price
      };
    });

    const company = await exe("SELECT * FROM company_info");

    const order = orderResult[0];
    if (!order) return res.status(404).send("Order not found");

    // ✅ Direct PDF response
    res.setHeader("Content-disposition", `attachment; filename=invoice_${id}.pdf`);
    res.setHeader("Content-type", "application/pdf");

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // === Company Info ===
    doc.fontSize(18).text(company[0].name, { align: "center", underline: true });
    doc.fontSize(10).text(company[0].address, { align: "center" });
    doc.text(`Phone: ${company[0].phone || "-"}`, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("INVOICE", { align: "center", underline: true });
    doc.moveDown();

    // === Order Info ===
    doc.fontSize(12).text(`Invoice No: ${order.order_id}`);
    doc.text(`Customer: ${order.name}`);
    doc.text(`Email: ${order.email}`);
    doc.text(`Phone: ${order.phone}`);
    doc.text(`Address: ${order.village}, ${order.taluka}, ${order.district}`);
    doc.text(`Payment Method: ${order.payment_method}`);
    doc.text(`Payment ID: ${order.payment_id || "-"}`);
    doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.moveDown(2);

    // === Products Table ===
    const tableTop = doc.y;
    const itemX = 50;
    const weightX = 220;
    const qtyX = 320;
    const priceX = 380;
    const totalX = 450;

    // Header background
    doc.rect(itemX - 5, tableTop - 5, 500, 20).fill("#f0f0f0").stroke();
    doc.fillColor("#000").fontSize(12).text("Product", itemX, tableTop);
    doc.text("Weight", weightX, tableTop);
    doc.text("Qty", qtyX, tableTop);
    doc.text("Price", priceX, tableTop);
    doc.text("Total", totalX, tableTop);

    doc.moveDown();
    let y = tableTop + 20;

    products.forEach(p => {
      doc.fontSize(10).fillColor("#000");
      doc.text(p.product_name, itemX, y);
      doc.text(p.weight, weightX, y);
      doc.text(p.quantity.toString(), qtyX, y);
      doc.text(`₹${p.price}`, priceX, y);
      doc.text(`₹${p.total}`, totalX, y);
      y += 20;
    });

    // Border line
    doc.moveTo(itemX - 5, tableTop - 5).lineTo(itemX - 5, y).stroke();
    doc.moveTo(weightX - 5, tableTop - 5).lineTo(weightX - 5, y).stroke();
    doc.moveTo(qtyX - 5, tableTop - 5).lineTo(qtyX - 5, y).stroke();
    doc.moveTo(priceX - 5, tableTop - 5).lineTo(priceX - 5, y).stroke();
    doc.moveTo(totalX - 5, tableTop - 5).lineTo(totalX - 5, y).stroke();
    doc.moveTo(itemX - 5, y).lineTo(totalX + 50, y).stroke();

    doc.moveDown(2);
    doc.fontSize(14).text(`Order Total: ₹${order.order_total}`, { align: "right", underline: true });

    doc.end();

  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).send("Error generating invoice");
  }
});





router.get("/recommendation",async function(req,res){
  // var lang = req.session.lang || "en"
  // var data = await exe(`SEELCT * FROM recomendations WHERE language = ? AND  `,[lang])

  res.render("user/recommendation.ejs" ,  {search: req.query.search || ''});
  
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

    res.render("user/category", { products: finalProducts, lang, search: req.query.search || '' });
  });
});

router.get("/schemes",function(req,res){
  res.render("user/schemes.ejs" ,  {search: req.query.search || '' })
})

router.get("/about",function(req,res){
  res.render("user/aboutus.ejs" ,  {search: req.query.search || '' })
})














module.exports = router;