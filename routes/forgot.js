var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
var exe = require('./conn');






router.get("/forgot_password", function (req, res) {
  res.render("forgot/forgot_password.ejs", { email: "", error: "" });
});


router.post("/send_otp", async function (req, res) {
  const email = req.body.email;

  try {
    const rows = await exe("SELECT * FROM users WHERE email = ?", [email]);

    if (!rows || rows.length === 0) {
      return res.render("forgot/forgot_password", { error: "Email is not registered", email });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    req.session.otp = otp;
    req.session.otp_email = email;
    req.session.otp_time = Date.now();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "gorakshnathdalavi91@gmail.com",
        pass: "yydh qpqv vovi fjsm",
      },
    });

    await transporter.sendMail({
      from: '"Admin Panel" <gorakshnathdalavi91@gmail.com>',
      to: email,
      subject: "Your OTP Code",
      html: `<p>Your OTP is <b>${otp}</b></p>`,
    });

    res.redirect("/forgot/verify_otp?status=sent");

  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).send("Failed to send OTP");
  }
});

router.get("/verify_otp", function (req, res) {
  const otpSentTime = req.session.otp_time || Date.now();
  const expiresIn = 10 * 60 * 1000;

  res.render("forgot/verify_otp.ejs", {
    otp_expiry_timestamp: otpSentTime + expiresIn,
    status: req.query.status,
  });
});

router.post("/verify_otp", function (req, res) {
  const userOtp = req.body.otp;
  const sessionOtp = req.session.otp;
  const otpTime = req.session.otp_time;

  const isExpired = Date.now() - otpTime > 10 * 60 * 1000;

  if (isExpired) {
    return res.send("<script>alert('OTP expired! Please try again.'); window.location='/accounts/forget_password';</script>");
  }

  if (parseInt(userOtp) === sessionOtp) {
    return res.send("<script>alert('OTP Verified! You can now reset your password.'); window.location='/forgot/reset_password';</script>");
  } else {
    return res.send("<script>alert('Invalid OTP! Please try again.'); window.location='/forgot/verify_otp';</script>");
  }
});

router.get("/reset_password", function (req, res) {
  if (!req.session.otp_email) return res.redirect("/forgot/forgot_password");

  res.render("forgot/reset_password.ejs", {
    status: req.query.status || null,
  });
});

  router.post("/reset_password", async function (req, res) {
  const { password, confirm } = req.body;

  if (password !== confirm) {
    return res.redirect("/forgot/reset_password?status=error");
  }

  const email = req.session.otp_email;

  const sql = `UPDATE users SET password = ? WHERE email = ?`;
  await exe(sql, [password, email]);

  req.session.otp = null;
  req.session.otp_email = null;
  req.session.otp_time = null;

  res.send("<script>alert('Password updated successfully!'); window.location='/login';</script>");
});




module.exports = router;