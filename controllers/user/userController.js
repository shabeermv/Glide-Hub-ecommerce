const User = require("../../models/userSchema");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const env = require("dotenv").config();
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const Category = require("../../models/categorySchema");
const ProductOffer = require("../../models/productOffer");
const CategoryOffer = require("../../models/categoryOffer");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const statusCode = require("../../utils/statusCodes");

const loadHome = async (req, res) => {
  try {
    const userId = req.session.userId;
    const products = await Product.find();
    const category = await Category.find();
    const productOffer = await ProductOffer.find();
    const categoryOffer = await CategoryOffer.find();

    let user = null;

    if (userId) {
      user = await User.findById(userId);
    }

    const categoryIds = [
      ...new Set(
        products.map((p) => p.category?._id?.toString()).filter(Boolean)
      ),
    ];
    const productIds = products.map((p) => p._id);

    const categoryOffers = await CategoryOffer.find({
      categoryId: { $in: categoryIds },
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();

    const productOffers = await ProductOffer.find({
      productId: { $in: productIds },
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    }).lean();

    const updatedProducts = products.map((product) => {
      const plainProduct = product.toObject ? product.toObject() : product;

      let discountedPrice = plainProduct.price;
      let appliedOffer = null;
      let offerType = null;

      if (!plainProduct._id) {
        return {
          ...plainProduct,
          image: plainProduct.image || [],
          originalPrice: plainProduct.price,
          discountedPrice: plainProduct.price,
          hasDiscount: false,
          appliedOffer: null,
          offerType: null,
        };
      }

      const productOffer = productOffers.find(
        (offer) => offer.productId.toString() === plainProduct._id.toString()
      );

      let categoryOffer = null;
      if (plainProduct.category && plainProduct.category._id) {
        categoryOffer = categoryOffers.find(
          (offer) =>
            offer.categoryId.toString() === plainProduct.category._id.toString()
        );
      }

      let productDiscountAmount = 0;
      let categoryDiscountAmount = 0;

      if (productOffer) {
        if (productOffer.discountType === "percentage") {
          productDiscountAmount =
            (plainProduct.price * productOffer.discountValue) / 100;
        } else if (productOffer.discountType === "fixed") {
          productDiscountAmount = productOffer.discountValue;
        }
      }

      if (categoryOffer) {
        if (categoryOffer.discountType === "percentage") {
          categoryDiscountAmount =
            (plainProduct.price * categoryOffer.discountValue) / 100;
        } else if (categoryOffer.discountType === "fixed") {
          categoryDiscountAmount = categoryOffer.discountValue;
        }
      }

      if (productDiscountAmount > 0 || categoryDiscountAmount > 0) {
        if (productDiscountAmount >= categoryDiscountAmount) {
          discountedPrice = plainProduct.price - productDiscountAmount;
          appliedOffer = {
            discountType: productOffer.discountType,
            discountValue: productOffer.discountValue,
            discountAmount: productDiscountAmount,
            description: productOffer.description,
          };
          offerType = "product";
        } else {
          discountedPrice = plainProduct.price - categoryDiscountAmount;
          appliedOffer = {
            discountType: categoryOffer.discountType,
            discountValue: categoryOffer.discountValue,
            discountAmount: categoryDiscountAmount,
            description:
              categoryOffer.description ||
              `${plainProduct.category.name} Category Offer`,
          };
          offerType = "category";
        }

        if (discountedPrice < 1) discountedPrice = 1;
      }

      return {
        ...plainProduct,
        originalPrice: plainProduct.price,
        discountedPrice: discountedPrice,
        hasDiscount: !!appliedOffer,
        appliedOffer: appliedOffer,
        offerType: offerType,
      };
    });

    res.render("home", {
      category,
      updatedProducts: updatedProducts.slice(0, 4),
      user,
    });
  } catch (error) {
    console.log("Home page not found", error);
    return res.json({ message: "interal server error" });
  }
};

const loadLogin = async (req, res) => {
  try {
    if (req.session.userId) {
      const userId = req.session.userId;
      const products = await Product.find();
      const category = await Category.find();
      const productOffer = await ProductOffer.find();
      const categoryOffer = await CategoryOffer.find();

      let user = null;
      if (userId) {
        user = await User.findById(userId);
      }

      const categoryIds = [
        ...new Set(
          products.map((p) => p.category?._id?.toString()).filter(Boolean)
        ),
      ];
      const productIds = products.map((p) => p._id);

      const categoryOffers = await CategoryOffer.find({
        categoryId: { $in: categoryIds },
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      }).lean();

      const productOffers = await ProductOffer.find({
        productId: { $in: productIds },
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      }).lean();

      const updatedProducts = products.map((product) => {
        const plainProduct = product.toObject ? product.toObject() : product;

        let discountedPrice = plainProduct.price;
        let appliedOffer = null;
        let offerType = null;

        if (!plainProduct._id) {
          return {
            ...plainProduct,
            image: plainProduct.image || [],
            originalPrice: plainProduct.price,
            discountedPrice: plainProduct.price,
            hasDiscount: false,
            appliedOffer: null,
            offerType: null,
          };
        }

        const productOffer = productOffers.find(
          (offer) => offer.productId.toString() === plainProduct._id.toString()
        );

        let categoryOffer = null;
        if (plainProduct.category && plainProduct.category._id) {
          categoryOffer = categoryOffers.find(
            (offer) =>
              offer.categoryId.toString() ===
              plainProduct.category._id.toString()
          );
        }

        let productDiscountAmount = 0;
        let categoryDiscountAmount = 0;

        if (productOffer) {
          if (productOffer.discountType === "percentage") {
            productDiscountAmount =
              (plainProduct.price * productOffer.discountValue) / 100;
          } else if (productOffer.discountType === "fixed") {
            productDiscountAmount = productOffer.discountValue;
          }
        }

        if (categoryOffer) {
          if (categoryOffer.discountType === "percentage") {
            categoryDiscountAmount =
              (plainProduct.price * categoryOffer.discountValue) / 100;
          } else if (categoryOffer.discountType === "fixed") {
            categoryDiscountAmount = categoryOffer.discountValue;
          }
        }

        if (productDiscountAmount > 0 || categoryDiscountAmount > 0) {
          if (productDiscountAmount >= categoryDiscountAmount) {
            discountedPrice = plainProduct.price - productDiscountAmount;
            appliedOffer = {
              discountType: productOffer.discountType,
              discountValue: productOffer.discountValue,
              discountAmount: productDiscountAmount,
              description: productOffer.description,
            };
            offerType = "product";
          } else {
            discountedPrice = plainProduct.price - categoryDiscountAmount;
            appliedOffer = {
              discountType: categoryOffer.discountType,
              discountValue: categoryOffer.discountValue,
              discountAmount: categoryDiscountAmount,
              description:
                categoryOffer.description ||
                `${plainProduct.category.name} Category Offer`,
            };
            offerType = "category";
          }

          if (discountedPrice < 1) discountedPrice = 1;
        }

        return {
          ...plainProduct,
          originalPrice: plainProduct.price,
          discountedPrice: discountedPrice,
          hasDiscount: !!appliedOffer,
          appliedOffer: appliedOffer,
          offerType: offerType,
        };
      });

      res.render("home", {
        category,
        updatedProducts: updatedProducts.slice(0, 4),
        user,
      });
    } else {
      // 🔹 if no session, just show login
      res.render("userLogin");
    }
  } catch (error) {
    console.log("Login page error", error);
    return res.json({ message: "internal server error" });
  }
};

const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const findUser = await User.findOne({ email: email.toLowerCase() });
    if (!findUser) {
      return res.json({ success: false, message: "Incorrect email" });
    }

    if (findUser.isBlocked) {
      return res.json({ success: false, message: "Your account is blocked" });
    }
    if (findUser.isAdmin) {
      return res.json({ success: false, message: "you are admin" });
    }

    const isPasswordValid = await bcrypt.compare(password, findUser.password);
    if (!isPasswordValid) {
      return res.json({ success: false, message: "Password not valid" });
    }

    req.session.userId = findUser.id;
    req.session.user = findUser;

    res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    return res.json({ message: "interal server error" });
  }
};

const loadSignUp = async (req, res) => {
  try {
    res.render("userSignUp");
  } catch (error) {
    console.log("Facing error on signup page", error.message);
    return res.json({ message: "internal server error" });
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 90000).toString();
}

async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
      tls: {
        ciphers: "SSLv3",
        rejectUnauthorized: false,
      },
    });

    console.log("testing smtp connection...");
    await transporter.verify();
    console.log("SMTP connection verified");

    const info = await transporter.sendMail({
      from: `"GlideHub" <${process.env.NODEMAILER_EMAIL}>`,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    console.log("Email sent successfully:", info.messageId);
    return true;
  } catch (error) {
    console.error("Detailed email error:", error);

    if (error.code) console.error("Error code:", error.code);
    if (error.response) console.error("Error response:", error.response);
    if (error.command) console.error("Failed command:", error.command);

    return false;
  }
}

const postSignUp = async (req, res) => {
  const { email, userName, contact, password, referalCode } = req.body;
  console.log("req.body fron post signup is ", req.body);

  try {
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.json({ success: false, message: "User already exists" });
    }

    const otp = generateOtp();
    console.log("genarate ot is calling is ==>", otp);
    const emailSent = await sendVerificationEmail(email, otp);
    // console.log("email sent  ot is calling is ==>",emailSent)
    if (!emailSent) {
      console.log("calling the not email");
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
      referalCode,
    };

    return res.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    next(error);
  }
};

const loadOtp = async (req, res) => {
  try {
    res.render("otp");
  } catch (error) {
    console.error("Error sharing OTP page", error);
    next(error);
  }
};

const postOtp = async (req, res, next) => {
  try {
    const { fillOtp } = req.body;
    const { email, userName, password, contact, referalCode } =
      req.session.user;

    console.log("Received OTP:", fillOtp);
    console.log("Expected OTP:", req.session.userOtp);

    if (fillOtp != req.session.userOtp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    let newReferralCode;
    let isUnique = false;

    while (!isUnique) {
      newReferralCode = crypto.randomBytes(4).toString("hex").toUpperCase();
      const existingUser = await User.findOne({ referalCode: newReferralCode });
      if (!existingUser) isUnique = true;
    }

    if (referalCode) {
      const referrer = await User.findOne({ referalCode: referalCode });
      if (referrer) {
        referrer.wallet += 100;

        referrer.walletHistory.push({
          date: new Date(),
          amount: 100,
        });

        await referrer.save();
        console.log(
          "Referrer rewarded:",
          referrer.email,
          "New wallet balance:",
          referrer.wallet
        );
      } else {
        console.log("Invalid referral code used:", referalCode);
      }
    }

    const newUser = new User({
      email,
      username: userName,
      contact,
      password,
      referalCode: newReferralCode,
    });

    const user = await newUser.save();

    req.session.userId = user._id;
    req.session.user = user;
    console.log("User Created:", user);
    req.session.save();

    return res.json({
      success: true,
      message: "OTP verified and user created successfully",
      referralCode: user.referalCode,
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    next(error);
  }
};

const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res
        .status(statusCode.INTERNAL_SERVER_ERROR)
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
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Session has expired" });
    }
    const email = req.session.user.email;
    const otp = generateOtp();

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res
        .status(statusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Error in sending OTP" });
    }

    req.session.userOtp = otp;
    res.json({ success: true });
  } catch (err) {
    console.error("Error in resending OTP:", err);
    next(error);
  }
};

const forgetPass = async (req, res) => {
  try {
    res.render("forgetPass");
  } catch (error) {
    console.log(error.message);
    next(error);
  }
};

const postForgetEmail = async (req, res) => {
  const { email } = req.body;
  console.log("Received email for password reset:", email);

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Email not found" });
    }
    req.session.userEmail = email;

    const otp = generateOtp();
    console.log(otp);
    req.session.userOtp = otp;

    const emailSent = await sendVerificationEmail(email);
    if (!emailSent) {
      return res
        .status(statusCode.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: "Error in sending OTP" });
    }

    req.session.userEmail = email.toLowerCase();

    res.status(statusCode.OK).json({
      success: true,
      message: "OTP sent to your email",
      showOtpModal: true,
    });
  } catch (error) {
    console.error("Error in password reset OTP request:", error);
    next(error);
  }
};

const postOtpForPasswordReset = async (req, res) => {
  const { otp } = req.body;
  console.log("Received OTP:", otp);

  try {
    console.log("Stored OTP in session:", req.session.userOtp);

    if (String(otp) !== String(req.session.userOtp)) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Invalid OTP" });
    }

    const user = await User.findOne({ email: req.session.userEmail });
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    res.status(statusCode.OK).json({
      success: true,
      message: "OTP verified successfully, now you can reset your password",
    });

    delete req.session.userOtp;
  } catch (error) {
    console.error("Error resetting password:", error);
    next(error);
  }
};

const resetPasswordForm = async (req, res) => {
  try {
    res.render("resetPassword");
  } catch (error) {
    console.log(error.message);
    next(error);
  }
};
const postResetPasswordByOtp = async (req, res) => {
  const { newPassword } = req.body;
  const email = req.session.userEmail;

  if (!newPassword) {
    return res
      .status(statusCode.BAD_REQUEST)
      .json({ success: false, message: "Password is required" });
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    await user.save();

    delete req.session.userEmail;

    res
      .status(statusCode.OK)
      .json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    next(error);
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

    const orders = await Order.find({ userId: userId })
      .populate({
        path: "products.productId",
        select: "title price",
      })
      .sort({ createdAt: -1 });

    const coupons = await Coupon.find({
      expireDate: { $gte: new Date() },
    }).sort({ expireDate: 1 });

    res.render("myAccount", {
      user,
      orders,
      referralCode: user.referalCode,
      coupons,
    });
  } catch (error) {
    console.error("Error in userProfileInfo:", error);
    return res.json({ message: "Internal server error" });
  }
};
const updateUserDetails = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res
        .status(statusCode.UNAUTHORIZED)
        .json({ success: false, message: "Unauthorized" });
    }

    const { fullName, mobileNumber } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username: fullName, contact: mobileNumber },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "User details updated successfully",
      user: {
        fullName: updatedUser.username,
        mobileNumber: updatedUser.contact,
      },
    });
  } catch (error) {
    console.error("Error updating user details:", error);
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const addAccountDetails = async (req, res, next) => {
  try {
    console.log("Received Request to Add Address");
    console.log("Request Body:", req.body);

    const { fullName, address, city, state, postCode, country } = req.body;

    if (!fullName || !address || !city || !state || !postCode || !country) {
      console.warn("Missing Fields:", req.body);
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "All fields are required." });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      console.warn("User Not Found:", req.session.userId);
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found." });
    }

    if (!Array.isArray(user.address)) {
      user.address = [];
    }

    user.address.push({ address, city, state, postCode, country });

    await user.save();
    console.log("Address Added Successfully for User:", user._id);

    return res.json({ success: true, message: "Address added successfully!" });
  } catch (error) {
    console.error("Error Adding Address:", error);
    next(error);
  }
};

const editProfileInfo = async (req, res) => {
  let user = null;
  if (req.session.userId) {
    user = await User.findById(req.session.userId);
  }

  res.render("editProfile", { user });
};
const addMoneyToWallet = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(401).send("User not logged in");
    }

    if (!amount || amount <= 0) {
      return res.status(400).send("Invalid amount");
    }

    // Update wallet
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    user.wallet += parseFloat(amount);

    // Add wallet history entry (optional)
    user.walletHistory.push({
      amount: parseFloat(amount),
      type: "credit",
      description: "Added to wallet",
    });

    await user.save();

    // Fetch orders and coupons to render myAccount page
    const orders = await Order.find({ userId: userId })
      .populate({ path: "products.productId", select: "title price" })
      .sort({ createdAt: -1 });

    const coupons = await Coupon.find({
      expireDate: { $gte: new Date() },
    }).sort({ expireDate: 1 });

    // Render myAccount page with updated data
    res.render("myAccount", {
      user,
      orders,
      referralCode: user.referalCode,
      coupons,
      successMessage: `₹${amount} added to wallet successfully!`,
    });
  } catch (err) {
    console.error("Error adding money to wallet:", err);
    res.status(500).send("Something went wrong");
  }
};

const editProfile = async (req, res) => {
  const { fullName, address, city, state, postCode, country } = req.body;

  console.log("all details achived here:", req.body);
  const userId = req.session.userId;

  if (!userId) {
    return res
      .status(statusCode.UNAUTHORIZED)
      .json({ success: false, message: "User not authenticated" });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
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
      .status(statusCode.OK)
      .json({ success: true, message: "User details updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    next(error);
  }
};
const deleteAddress = async (req, res) => {
  const addressId = req.params.id;
  const userId = req.session.userId;

  // console.log('addressid kitttiiiiiii',addressId);

  try {
    if (!userId) {
      return res
        .status(statusCode.UNAUTHORIZED)
        .json({ success: false, message: "User not authenticated" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    user.address = user.address.filter(
      (address) => address._id.toString() !== addressId
    );

    await user.save();

    return res.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "internal server error" });
  }
};

const resetLoginedPasswrod = async (req, res) => {
  try {
    res.render("resetNewPassword");
  } catch (error) {
    next(error);
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
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "user not found" });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      console.log("Old password does not match stored password");
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Invalid old password" });
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    req.session.user.password = hashedNewPassword;
    user.password = hashedNewPassword;
    await user.save();
    console.log("password changeddddd");

    return res
      .status(statusCode.OK)
      .json({ success: true, message: "password changed successfully.." });
  } catch (error) {
    console.log("internal server error....", error);

    next(error);
  }
};

const blogInfo = async (req, res) => {
  res.render("404");
};

const contactInfo = async (req, res) => {
  let user = null;
  if (req.session.userId) {
    user = await User.findById(req.session.userId);
  }

  res.render("contact", { user });
};
const sendMessage = async (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res
      .status(statusCode.BAD_REQUEST)
      .json({ message: "All fields are required" });
  }

  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    let mailOptions = {
      from: email,
      to: "glidehub.sales@gmail.com",
      subject: "New Contact Form Submission",
      text: `You have a new message from: ${email}\n\nMessage: ${message}`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: "Email sent successfully!" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const aboutInfo = async (req, res) => {
  let user = null;
  if (req.session.userId) {
    user = await User.findById(req.session.userId);
  }

  const categories = await Category.find({});
  const products = await Product.find({});
  res.render("about", { categories, products, user });
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
  addMoneyToWallet,
  updateUserDetails,
  addAccountDetails,
  editProfileInfo,
  editProfile,
  deleteAddress,
  resetLoginedPasswrod,
  postResetPassword,
  blogInfo,
  contactInfo,
  sendMessage,
  aboutInfo,
};
