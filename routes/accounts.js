var express = require("express");
var router =  express.Router()
var exe = require("./conn");
var CheckLogin = require("./CheckLogin");
router.get("/login",function(req,res){
    res.render("accounts/login.ejs");
});

router.post("/login",async function(req,res){
// var d = req.body;
    var match = `SELECT * FROM admin WHERE email = ? AND password = ?`;
    var data = await exe(match,[req.body.email,req.body.password]);
    // res.send(data);
    if(data.length > 0)
    {
        req.session.admin = data[0];
        res.redirect("/admin/");
    }else {
        res.send("Envalid Details! Please Enter Correct Details")
    }
})

router.get("/logout",function(req,res){
    req.session.destroy();
    res.redirect("/accounts/login");
});

router.post("/update-profile",CheckLogin,async function(req,res){
    var d = req.body;
    var sql = `UPDATE admin SET name = ?, email = ? , phone = ? WHERE admin_id = ?`;
    var data = await exe(sql,[d.name,d.email,d.phone,d.admin_id]);

    req.session.admin.name = d.name; 
    req.session.admin.email = d.email; 
    req.session.admin.phone = d.phone; 
    // res.send(data);
    res.redirect("/admin/profile");

})



module.exports = router;