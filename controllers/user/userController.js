const User = require("../../models/userSchema");
const bcrypt = require("bcryptjs");
const nodemailer = require('nodemailer');
const env = require("dotenv").config();

const Product = require('../../models/productSchema');

const loadHome = async (req, res) => {
  try {
    const products = await Product.find();
    if (req.session.user) {
      res.render('home', { products });
    } else {
      res.render('userLogin');
    }
  } catch (error) {
    console.log("Home page not found", error);
    res.status(500).send("Server error");
  }
};

const loadLogin = async (req, res) => {
  if (req.session.user) {
    res.render("home");
  } else {
    res.render("userLogin");
  }
};


const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login - Received email:", email);
    console.log("Login - Received password:", password);

    // Find user by email
    const findUser = await User.findOne({ email: email.toLowerCase() });
    if (!findUser) {
      return res.json({ success: false, message: "Incorrect email" });
    }

    // console.log("Login - Found user:", findUser);
    // console.log("Login - Stored hash:", findUser.password);
    // console.log("login passwor d",await bcrypt.hash(password,10));

    

    const isPasswordValid = await bcrypt.compare(password,findUser.password);
    // console.log("Login - Password comparison result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.json({success: false,message:'password not valid'} );
    }

    req.session.userId = findUser.id;
    req.session.user = findUser;
    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error("Login error:", error);
    res.json({ success: false, message: 'Internal server error' });
  }
};


const loadSignUp = async (req, res) => {
  try {
    res.render("userSignUp");
  } catch (error) {
    console.log("Facing error on signup page", error.message);
    res.status(500).send("Error loading signup page");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 90000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
      debug: true
    });

    console.log("Sending email from:", process.env.NODEMAILER_EMAIL);
    console.log("Sending email to:", email);

    await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "verify your account",
      text: `your otp is ${otp}`,
      html: `<b>your otp : ${otp}</b>`,
    }, (error, info) => {
      console.log(error, info);
    });

    return true;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const postSignUp = async (req, res) => {
  const { email, userName, contact, password } = req.body;
  console.log("Received data:", req.body);

  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json({ success: false, message: 'Email not sent' });
    }

    console.log("Generated OTP:", otp);
    req.session.userOtp = otp;
    // console.log(password,"fkajkfsjkdjfaskdf");
    
    // Hash the password and log it
    const hashedPassword = await bcrypt.hash(password, 10);
    // console.log("Hashed password:", hashedPassword);

    req.session.user = {
      email: email.toLowerCase(),
      userName,
      contact,
      password: hashedPassword
    };

    return res.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).render("error", { message: "Internal server error" });
  }
};

const loadOtp = async (req, res) => {
  try {
    res.render('otp');
  } catch (error) {
    console.error('Error sharing OTP page', error);
  }
};

const postOtp = async (req, res) => {
  try {
    const { fillOtp } = req.body;
    const { email, userName, password, contact } = req.session.user;

    console.log("Received OTP:", fillOtp);
    console.log("Expected OTP:", req.session.userOtp);

    if (fillOtp != req.session.userOtp) {
      return res.json({ success: false, message: 'Invalid OTP' });
    }
   
    const newUser = new User({
      email,
      username: userName,
      contact,
      password: password,
    });

    const user = await newUser.save();

   
    req.session.userId = user.id;
    req.session.user = user; 
    console.log(user); 

    return res.json({ success: true, message: 'OTP verified and user created successfully' });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.json({ success: false, message: 'Error verifying OTP' });
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};

const resendOtp = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.email) {
      return res.status(400).json({ success: false, message: 'Session has expired' });
    }

    const email = req.session.user.email;
    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Error in sending OTP' });
    }

    req.session.userOtp = otp;
    res.json({ success: true });
  } catch (err) {
    console.error('Error in resending OTP:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const forgetPass = async (req, res) => {
  try {
    res.render('forgetPass');
  } catch (error) {
    console.error('Error loading forget password page', error);
  }
};





// user profile


const userProfileInfo=async(req,res)=>{
  res.render('myAccount',{title:'My Account'});
}

module.exports = {
  loadHome,
  loadLogin,
  loadSignUp,
  postSignUp,
  postLogin,
  logout,
  loadOtp,
  postOtp,
  forgetPass,
  resendOtp,
  userProfileInfo
};
