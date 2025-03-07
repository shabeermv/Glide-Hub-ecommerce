const express=require('express')
const userRouter=express.Router();
const userController=require('../controllers/user/userController');
const productController=require('../controllers/user/productControllers')
const cartController=require('../controllers/user/cartController')
const authMiddleware=require('../middleware/middlewares');
const wishlistController=require('../controllers/user/wishlistController')
const checkoutController=require('../controllers/user/checkoutController');
const couponController = require('../controllers/admin/couponController')
const passport=require('../config/passport')


userRouter.get('/',userController.loadHome);
userRouter.get('/login',authMiddleware.signMiddleware,userController.loadLogin);
userRouter.post('/login',authMiddleware.signMiddleware,userController.postLogin)
userRouter.get('/signup',authMiddleware.signMiddleware,userController.loadSignUp)
userRouter.post('/signup',authMiddleware.signMiddleware,userController.postSignUp)
userRouter.get('/logout',authMiddleware.authMiddleware,userController.logout);
userRouter.get('/otp',authMiddleware.signMiddleware,userController.loadOtp)
userRouter.post('/otp',authMiddleware.signMiddleware,userController.postOtp);
userRouter.post('/resendOtp',userController.resendOtp);
userRouter.get('/forgetPassword',userController.forgetPass);
userRouter.post('/forgetPassword',userController.postForgetEmail);
userRouter.post('/resetPassOtp',userController.postOtpForPasswordReset);
userRouter.get('/resetPasswordByOtp',userController.resetPasswordForm);
userRouter.patch('/resetPasswordByOtp',userController.postResetPasswordByOtp)
userRouter.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
userRouter.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/');
});

//product

userRouter.get('/show/:id',authMiddleware.authMiddleware,productController.getDetailInfo)
userRouter.get('/shop',authMiddleware.authMiddleware,productController.shopInfo);

userRouter.get('/profile',authMiddleware.authMiddleware,userController.userProfileInfo);
userRouter.post('/accountDetails',authMiddleware.authMiddleware,userController.addAccountDetails);
userRouter.get('/editProfile/:id',authMiddleware.authMiddleware,userController.editProfileInfo);
userRouter.patch('/editProfile/:id',authMiddleware.authMiddleware,userController.editProfile);
userRouter.delete('/deleteAddress/:id',authMiddleware.authMiddleware,userController.deleteAddress);
userRouter.get('/resetPassword',authMiddleware.authMiddleware,userController.resetLoginedPasswrod);
userRouter.patch('/resetPassword',authMiddleware.authMiddleware,userController.postResetPassword);



userRouter.get('/cart',authMiddleware.authMiddleware,cartController.cartPageInfo);
userRouter.post('/cart/add',authMiddleware.authMiddleware,cartController.addProductCart);
userRouter.delete('/deleteCartItem/:id',authMiddleware.authMiddleware,cartController.deleteProductCart);
userRouter.patch('/updateQuantity/:id',authMiddleware.authMiddleware,cartController.updateProductQuantity);
userRouter.get('/cart/add-from-wishlist', authMiddleware.authMiddleware, cartController.addProductToCartFromWishlist);

userRouter.get('/wishlist',authMiddleware.authMiddleware,wishlistController.wishlistPageInfo);

userRouter.post('/wishlist/add/:id',authMiddleware.authMiddleware,wishlistController.addProductWishlist);
userRouter.delete('/removeWishlistItem/:id',authMiddleware.authMiddleware,wishlistController.removeWishlistItem);


userRouter.get('/checkout/:id',authMiddleware.authMiddleware,checkoutController.checkoutPageInfo);
userRouter.get('/cart-checkout', authMiddleware.authMiddleware, checkoutController.cartCheckoutPage);
userRouter.post('/place-order',authMiddleware.authMiddleware,checkoutController.buyNow);
userRouter.get('/eligible-coupons', couponController.getEligibleCoupons);
userRouter.post('/apply-coupon', couponController.applyCoupon);
userRouter.delete('/cancelOrder/:id',authMiddleware.authMiddleware,checkoutController.cancelOrder);
userRouter.get('/order/details/:id',authMiddleware.authMiddleware,checkoutController.viewPurchaseDetails);
userRouter.post('/return-order',checkoutController.returnOrder);

userRouter.post('/create-razorpay-order',checkoutController.razorpayCreation);
userRouter.post('/verify-razorpay-payment',checkoutController.verifyRazorPay);




userRouter.get('/blog',userController.blogInfo);

userRouter.get('/contact',userController.contactInfo);
userRouter.post('/send-email',userController.sendMessage)

userRouter.get('/about',userController.aboutInfo);



module.exports=userRouter;