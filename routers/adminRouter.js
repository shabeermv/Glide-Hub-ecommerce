// routers/adminRouter.js
const express = require('express');
const adminRouter = express.Router();
const adminController = require('../controllers/admin/adminControllers');
const upload = require('../middleware/multer');
const productController = require('../controllers/admin/productControllers');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryControllers');


// Admin routes
adminRouter.get('/adminLogin', adminController.adminLogin);
adminRouter.post('/adminLogin', adminController.postAdmin);
adminRouter.get('/home', adminController.getHome);

// Products routes
adminRouter.get('/products', productController.productsInfo);
adminRouter.get('/addProduct', productController.addProductInfo);
adminRouter.post('/addProduct', upload.array('images', 3), productController.productAdd);
adminRouter.get('/productDetails/:id',productController.getProductDeatilsInfo);
adminRouter.get('/edit/:id',productController.renderEditProduct);
adminRouter.post('/updateProduct/:id', upload.array('images', 3), productController.updateProduct);
adminRouter.delete('/delete/:id',productController.deleteProduct);

// Users address
adminRouter.get('/users', customerController.userInfo);
adminRouter.post('/users/block/:id',customerController.blockUser);
adminRouter.post('/users/unBlock/:id',customerController.unBlockUser);

// Categories routes
adminRouter.get('/categories', categoryController.getCategory);
adminRouter.post('/addCategory', categoryController.addCategory);
adminRouter.get('/edit/:id',categoryController.renderEditCategory);
adminRouter.put('/edit/:id',categoryController.updateCategory);
adminRouter.delete('/delete/:id',categoryController.deleteCategory)


module.exports = adminRouter;
