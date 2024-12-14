const express=require('express')
const userRouter=express.Router();
const userController=require('../controllers/user/userController');
const productController=require('../controllers/user/productControllers')
const authMiddleware=require('../middleware/middlewares');
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
userRouter.get('/forgetPass',userController.forgetPass);
userRouter.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
userRouter.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/');
});

//product

userRouter.get('/show/:id',productController.getDetailInfo)
userRouter.get('/shop',productController.shopInfo)

module.exports=userRouter;