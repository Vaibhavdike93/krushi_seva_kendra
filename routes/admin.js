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

router.get("/Add_product_Brand",async function(req,res){
   var sql = `SELECT * FROM product_barand`;
  var brands = await exe(sql);
  res.render("admin/Add_product_Brand.ejs",{brands})
})

router.post("/add_brand",async function(req,res){
  var d = req.body;
  if(req.files)
  {
    var filename = new Date().getTime()+req.files.brandImage.name;
    req.files.brandImage.mv("public/brands/"+filename);
  }else{
    var filename ="";
  }
  var sql = `INSERT INTO product_barand (brand_name, barnd_img) VALUES (?, ?)`;
  var result = await exe(sql,[d.brandName,filename]);
    res.redirect("/admin/Add_product_Brand")
})

router.get("/edit_brand/:id",async function(req,res){
  var id = req.params.id;
  var sql = "SELECT * FROM product_barand WHERE id = ?";
  var brand = await exe(sql,{id});
  res.render("admin/edit_product_brand.ejs",{brand})
})

router.post("/edit_brand/:id",async function(req,res){
  var id = req.params.id;
  var d = req.body;
  if(req.files)
  {
    var filename = new Date().getTime()+req.files.brandImage.name;
    req.files.brandImage.mv("public/brands/"+filename);
  }
  else{
    var old_img = await exe(`SELECT barnd_img FROM product_barand WHERE id = '${id}'`);
    filename = old_img[0].barnd_img; 
  }
  var sql = `UPDATE product_barand SET 
  brand_name = ?,
  barnd_img = ?
  WHERE id = ?
  `
  var result = await exe(sql,[d.brandName,filename,id]);
   res.redirect("/admin/Add_product_Brand")
})

router.get("/delete_brand/:id",async function(req,res){
  var id = req.params.id;
  var sql = `DELETE FROM product_barand WHERE id = ?`;
  var result = await exe(sql,[id]);
   res.redirect("/admin/Add_product_Brand")
})



module.exports = router;