const User = require("../../models/userSchema");
const bcrypt = require("bcrypt");
const nodemailer=require('nodemailer')
const env = require("dotenv").config();
const JWT=require('jsonwebtoken');
const Product=require('../../models/productSchema')
// console.log(User);

const loadHome = async (req, res) => {
  try {
    const products = await Product.find();
      res.render('home',{products})
    
  } catch (error) {
    console.log("Home page not found");
    res.status(500), res.send("Server error");
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
    // console.log(req.body);

    const findUser = await User.findOne({ isAdmin: 0, email: email });

    if (!findUser) {
      return res.json({ success: false, message: "Incorrect user" });
    }
    if (findUser.isBlocked) {
      return res.json({ success: false, message: "user blocked" });
    }

    const isPasswordValid = await bcrypt.compare(password, findUser.password);

    if (!isPasswordValid) {
      return res.json({ success: false, message: "Incorrect password" });
    }
    const payload={
      userId:user._id,
      username:user.username
    }
    const token=JWT.sign(payload,process.env.JWT_SECRET,{
      expiresIn:process.env.JWT_EXPIRES_IN
    })

    req.session.userId = findUser.id;

    res.json({ success: true,token: `Bearer ${token}` });
  } catch (error) {
    console.log(error);
    res.json({ success: false });
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
async function sendVerificationEmail(email,otp) {
 
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
      debug:true
    });
    console.log(process.env.NODEMAILER_EMAIL);
    console.log(process.env.NODEMAILER_PASSWORD);
    // console.log(transporter);
    
    
    
    await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "verify your account",
      text: `your otp is ${otp}`,
      html: `<b>your otp : ${otp}</b>`,
    },(error,info)=>{
        console.log(error,info);
        
    });

    return true
  } catch (error) {
    console.error("error sending email", error);
    return false;
  }
}

const postSignUp = async (req, res) => {
  const { email, userName,contact,password } = req.body;
//   console.log("Received data:", req.body);

  try {
    const findUser = await User.findOne({email});
    if (findUser) {
      return res.json({ success: false, message: "user already exist" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email,otp);
    if (!emailSent) {
      return res.json({ success: false ,message:'email is not send'});
    }
    console.log(otp)
    req.session.userOtp = otp;
    req.session.user = {
      email,
      userName,
      contact,
      password,
    };

   
    return res.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).render("error", { message: "Internal server error" });
  }
};

const loadOtp=async(req,res)=>{
    try {
        res.render('otp')
    } catch (error) {
        console.error('cant share otp page',error)
    }
}

const postOtp=async(req,res)=>{
  try {
      console.log(req.session);
        const {fillOtp}=req.body;
        const {email,userName,password,contact}=req.session.user;
        console.log(req.body);
        if (fillOtp != req.session.userOtp) {
          return res.json({ success: false, message: 'Invalid OTP' });
      }
      
      
         const hashedPassword = await bcrypt.hash(password, 10);
         const newUser = new User({
         email,
         username: userName,
         contact,
         password: hashedPassword,
           });
           const user= await newUser.save();

    

       console.log("Session data:", req.session);

       req.session.userId=user.id



        
        return res.json({success:true})
    
    } catch (error) {
        console.error('feeling error in otp ',error);
    }
}

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(500)
        .json({ success: false, message: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
};

const resendOtp=async(req,res)=>{
  try {
     
    if(!req.session.user||!req.session.user.email){
      return res.status(400).json({success:false,message:'session has expired'})
    }
    const email=req.session.user.email;
    const otp=generateOtp();
   console.log(otp);

    const emailSent=await sendVerificationEmail(email,otp);
    if(!emailSent){
      return res.status(500).json({success:false,message:'feeling error in sending otp'});
    }
    req.session.userOtp=otp;
    res.json({success:true});
    
  } catch (err) {
    console.error('have error',err);
    return res.status(500).json({success:false,message:'have error fully'});
    
  }
}

const forgetPass=async(req,res)=>{
  try {
    res.render('forgetPass')
  } catch (error) {
    console.error('feeling error',error);
  }
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
  resendOtp

};
