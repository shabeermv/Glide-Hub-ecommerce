const User = require("../../models/userSchema");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Category = require("../../models/categorySchema");

const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");

const loadHome = async (req, res) => {
  try {
    const userId = req.session.userId;
    const products = await Product.find();
    const category = await Category.find();

    if (req.session.user) {
      res.render("home", { category, products, user: req.session.user });
    } else {
      res.render("userLogin");
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

    // Find user by email
    const findUser = await User.findOne({ email: email.toLowerCase() });
    if (!findUser) {
      return res.json({ success: false, message: "Incorrect email" });
    }

    // Check if the user is blocked
    if (findUser.isBlocked) {
      return res.json({ success: false, message: "Your account is blocked" });
    }
    if(findUser.isAdmin){
      return res.json({success:false,message:'you are admin'})
    }

    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, findUser.password);
    if (!isPasswordValid) {
      return res.json({ success: false, message: "Password not valid" });
    }

    // Set session for the user
    req.session.userId = findUser.id;
    req.session.user = findUser;

    res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    res.json({ success: false, message: "Internal server error" });
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
      debug: true,
    });

    console.log("Sending email from:", process.env.NODEMAILER_EMAIL);
    console.log("Sending email to:", email);

    await transporter.sendMail(
      {
        from: process.env.NODEMAILER_EMAIL,
        to: email,
        subject: "verify your account",
        text: `your otp is ${otp}`,
        html: `<b>your otp : ${otp}</b>`,
      },
      (error, info) => {
        console.log(error, info);
      }
    );

    return true;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

const postSignUp = async (req, res) => {
  const { email, userName, contact, password } = req.body;
  // console.log("Received data:", req.body);

  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json({ success: false, message: "Email not sent" });
    }

    console.log("Generated OTP:", otp);
    req.session.userOtp = otp;
    // console.log(password,"fkajkfsjkdjfaskdf");

    const hashedPassword = await bcrypt.hash(password, 10);
    // console.log("Hashed password:", hashedPassword);

    req.session.user = {
      email: email.toLowerCase(),
      userName,
      contact,
      password: hashedPassword,
    };

    return res.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).render("error", { message: "Internal server error" });
  }
};

const loadOtp = async (req, res) => {
  try {
    res.render("otp");
  } catch (error) {
    console.error("Error sharing OTP page", error);
  }
};

const postOtp = async (req, res) => {
  try {
    const { fillOtp } = req.body;
    const { email, userName, password, contact } = req.session.user;

    console.log("Received OTP:", fillOtp);
    console.log("Expected OTP:", req.session.userOtp);

    if (fillOtp != req.session.userOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    const newUser = new User({
      email,
      username: userName,
      contact,
      password: password,
    });

    const user = await newUser.save();

    req.session.userId = user._id;
    req.session.user = user;
    console.log(user);
    req.session.save();

    return res.json({
      success: true,
      message: "OTP verified and user created successfully",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.json({ success: false, message: "Error verifying OTP" });
  }
};

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

const resendOtp = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.email) {
      return res
        .status(400)
        .json({ success: false, message: "Session has expired" });
    }
    const email = req.session.user.email;
    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Error in sending OTP" });
    }

    req.session.userOtp = otp;
    res.json({ success: true });
  } catch (err) {
    console.error("Error in resending OTP:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

const forgetPass = async (req, res) => {
  try {
    res.render("forgetPass");
  } catch (error) {
    console.log(error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Error rendering forget password page",
      });
  }
};

const postForgetEmail = async (req, res) => {
  const { email } = req.body;
  console.log("Received email for password reset:", email);

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Email not found" });
    }
    req.session.userEmail = email;

    const otp = generateOtp();
    console.log(otp);
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Error in sending OTP" });
    }

    req.session.userEmail = email.toLowerCase();

    res
      .status(200)
      .json({
        success: true,
        message: "OTP sent to your email",
        showOtpModal: true,
      });
  } catch (error) {
    console.error("Error in password reset OTP request:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const postOtpForPasswordReset = async (req, res) => {
  const { otp } = req.body;
  console.log("Received OTP:", otp);

  try {
    console.log("Stored OTP in session:", req.session.userOtp);

    if (String(otp) !== String(req.session.userOtp)) {
      return res.status(404).json({ success: false, message: "Invalid OTP" });
    }

    const user = await User.findOne({ email: req.session.userEmail });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res
      .status(200)
      .json({
        success: true,
        message: "OTP verified successfully, now you can reset your password",
      });

    delete req.session.userOtp;
  } catch (error) {
    console.error("Error resetting password:", error);
    res
      .status(500)
      .json({ success: false, message: "Error resetting password" });
  }
};

const resetPasswordForm = async (req, res) => {
  try {
    res.render("resetPassword");
  } catch (error) {
    console.log(error.message);
  }
};
const postResetPasswordByOtp = async (req, res) => {
  const { newPassword } = req.body;
  const email = req.session.userEmail;

  if (!newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Password is required" });
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    delete req.session.userEmail;

    res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res
      .status(500)
      .json({ success: false, message: "Error resetting password" });
  }
};

// user profile

const userProfileInfo = async (req, res) => {
  try {
      const userId = req.session.userId;
      const user = await User.findById(userId);
      
      if (!user) {
          return res.redirect("/login");
      }

      // Fetch all orders with populated product details
      const orders = await Order.find({ userId: userId })
          .populate({
              path: 'products.productId',
              select: 'title price' // Changed from 'name' to 'title'
          })
          .sort({ createdAt: -1 });

      // Calculate total amount for each order if not present
      orders.forEach(order => {
          // Calculate total amount from products
          const calculatedTotal = order.products.reduce((sum, product) => {
              return sum + (product.price * product.quantity);
          }, 0);
          
          // Use calculated total if totalAmount is not present
          order.totalAmount = order.totalAmount || calculatedTotal;
      });

      res.render("myAccount", { user, orders });
  } catch (error) {
      console.error('Error in userProfileInfo:', error);
      res.status(500).render('error', { message: 'Internal server error' });
  }
};
const addAccountDetails = async (req, res) => {
  // console.log(req.body, 'controllersil ethi.........');

  try {
    const { fullName, address, city, state, postCode, country } = req.body;

    if (!fullName || !address || !city || !state || !postCode || !country) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    if (fullName !== user.fullName) {
      user.fullName = fullName;
    }

    user.address.push({ fullName, address, city, state, postCode, country });
    await user.save();

    return res.json({ success: true, message: "Address added successfully!" });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const editProfileInfo = async (req, res) => {
  const user = req.session.user;
  // console.log(user,'edit profile user get......');

  res.render("editProfile", { user });
};

const editProfile = async (req, res) => {
  const { fullName, address, city, state, postCode, country } = req.body;

  console.log('all details achived here:',req.body);
  const userId = req.session.userId;

  if (!userId) {
    return res
      .status(401)
      .json({ success: false, message: "User not authenticated" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.fullName = fullName;
    user.address = [
      {
        address: address,
        city: city,
        state: state,
        postCode: postCode,
        country: country,
      },
    ];

    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "User details updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Error updating user details" });
  }
};
const deleteAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.session.userId;

  // console.log('addressid kitttiiiiiii',addressId);

  try {
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Remove address by filtering out the address with matching ID
    user.address = user.address.filter(
      (address) => address._id.toString() !== addressId
    );

    await user.save();

    return res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetLoginedPasswrod = async (req, res) => {
  try {
    res.render('resetNewPassword');
  } catch (error) {
    return res.status(500).json({success:false,message:'internal server error'})
  }
};
const postResetPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  console.log(req.body, "old and new password.....");
  const userId = req.session.userId;
  console.log(userId, "usreIddddddd..");

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "user not found" });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      console.log("Old password does not match stored password");
      return res
        .status(400)
        .json({ success: false, message: "Invalid old password" });
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    req.session.user.password = hashedNewPassword;
    user.password = hashedNewPassword;
    await user.save();
    console.log("password changeddddd");

    return res
      .status(200)
      .json({ success: true, message: "password changed successfully.." });
  } catch (error) {
    console.log("internal server error....", error);

    return res
      .status(500)
      .json({ success: false, message: "interal server error" });
  }
};

const blogInfo = async (req, res) => {
  res.render("404");
};

const contactInfo = async (req, res) => {
  res.render("404");
};

const aboutInfo = async (req, res) => {
  res.render("404");
};

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
  postForgetEmail,
  postOtpForPasswordReset,
  resetPasswordForm,
  postResetPasswordByOtp,
  resendOtp,
  userProfileInfo,
  addAccountDetails,
  editProfileInfo,
  editProfile,
  deleteAddress,
  resetLoginedPasswrod,
  postResetPassword,
  blogInfo,
  contactInfo,
  aboutInfo,
};
