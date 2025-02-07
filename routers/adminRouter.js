// routers/adminRouter.js
const express = require('express');
const adminRouter = express.Router();
const adminController = require('../controllers/admin/adminControllers');
const upload = require('../middleware/multer');
const productController = require('../controllers/admin/productControllers');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryControllers');
const orderController=require('../controllers/admin/orderController');


// Admin routes
adminRouter.get('/adminLogin', adminController.adminLogin);
adminRouter.post('/adminLogin', adminController.postAdmin);
adminRouter.get('/home', adminController.getHome);
adminRouter.get('/logoutAdmin',adminController.logoutAdmin);

// Products routes
adminRouter.get('/products', productController.productsInfo);
adminRouter.get('/addProduct', productController.addProductInfo);
adminRouter.post('/addProduct', upload.array('images', 3), productController.productAdd);
adminRouter.get('/productDetails/:id',productController.getProductDeatilsInfo);
adminRouter.get('/edit/:id',productController.renderEditProduct);
adminRouter.patch('/updateProduct/:id', upload.array('images', 3), productController.updateProduct);
adminRouter.delete('/delete/:id', productController.softDeleteProduct);

// Users address
adminRouter.get('/users', customerController.userInfo);
adminRouter.patch('/users/block-unblock/:userId', customerController.toggleBlockStatus);

// Categories routes
adminRouter.get('/categories', categoryController.getCategory);
adminRouter.post('/addCategory', categoryController.addCategory);
adminRouter.get('/editCategory/:id',categoryController.renderEditCategory);
adminRouter.put('/editCategory/:id',categoryController.updateCategory);
adminRouter.delete('/soft-delete/:id', categoryController.deleteCategory);
adminRouter.put('/toggle-status/:id', categoryController.toggleCategoryStatus);


adminRouter.get('/userOrders',orderController.userOrdersInfo);
adminRouter.post('/orders/update-status',orderController.changeOrderStatus);


module.exports = adminRouter;
