var express = require("express");
var exe = require("../conn");
var router = express.Router();

router.get("/",function(req,res){
    res.render("admin/index.ejs")
})


module.exports = router;