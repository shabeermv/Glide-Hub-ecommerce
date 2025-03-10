// routers/adminRouter.js
const express = require('express');
const adminRouter = express.Router();
const adminController = require('../controllers/admin/adminControllers');
const upload = require('../middleware/multer');
const productController = require('../controllers/admin/productControllers');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryControllers');
const couponController = require('../controllers/admin/couponController');
const orderController=require('../controllers/admin/orderController');
const middleware=require('../middleware/middlewares')


// Admin routes
adminRouter.get('/adminLogin', adminController.adminLogin);
adminRouter.post('/adminLogin', adminController.postAdmin);
adminRouter.get('/home', adminController.getHome);
adminRouter.get('/sales-data',adminController.getSalesData)
adminRouter.get('/logoutAdmin',adminController.logoutAdmin);
adminRouter.get('/downloadOrdersPDF',adminController.downloadOrdersPDF);
adminRouter.get('/downloadOrdersExcel', adminController.downloadOrdersExcel);
adminRouter.get('/orderFilterByCategory', adminController.filterCategoryList);
adminRouter.get('/filterByDate',adminController.getFilterByDate);
adminRouter.get('/filterByStatus',adminController.filterByStatus);


// Products routes
adminRouter.get('/products', productController.productsInfo);
adminRouter.get('/addProduct', productController.addProductInfo);
adminRouter.post('/addProduct', upload.array('images', 3), productController.productAdd);
adminRouter.get('/productDetails/:id',productController.getProductDeatilsInfo);
adminRouter.get('/edit/:id',productController.renderEditProduct);
adminRouter.patch('/updateProduct/:id', upload.array('images', 3), productController.updateProduct);
adminRouter.put('/delete/:id', productController.softDeleteProduct);
adminRouter.put('/recover/:id',productController.recoverProduct)

// Users address
adminRouter.get('/users', customerController.userInfo);
adminRouter.patch('/users/block-unblock/:userId',middleware.distroyByBlocking,customerController.toggleBlockStatus);

// Categories routes
adminRouter.get('/categories', categoryController.getCategory);
adminRouter.post('/addCategory', categoryController.addCategory);
adminRouter.get('/editCategory/:id',categoryController.renderEditCategory);
adminRouter.put('/editCategory/:id',categoryController.updateCategory);
adminRouter.delete('/soft-delete/:id', categoryController.deleteCategory);
adminRouter.put('/toggle-status/:id', categoryController.toggleCategoryStatus);


//offer side
adminRouter.get('/categoryOffer',categoryController.viewCategoryOfferInfo);
adminRouter.post('/addCategoryOffer',categoryController.addCategoryOffer);
adminRouter.delete('/deleteCategoryOffer/:id',categoryController.deleteCategoryOffer);
adminRouter.put('/updateCategoryOffer/:id',categoryController.updateCategoryOffer);
adminRouter.get('/productOffer',productController.viewProductOfferInfo);
adminRouter.post('/addProductOffer',productController.addProductOffer);
adminRouter.delete('/deleteProductOffer/:id',productController.deleteProductOffer);
adminRouter.put('/updateProductOffer/:id',productController.editProductOffer);



adminRouter.get('/userOrders',orderController.userOrdersInfo);
adminRouter.post('/orders/update-status',orderController.changeOrderStatus);
adminRouter.get('/orders/:id',orderController.viewOrderDetails);
adminRouter.get('/invoice/:id',orderController.getInvoice);
adminRouter.post('/approve-return',orderController.approveReturn);




adminRouter.get('/coupon',couponController.couponPageInfo);
adminRouter.post('/coupons/add',couponController.addCoupon);
adminRouter.delete('/deleteCoupon/:id',couponController.deleteCoupon);
adminRouter.get('/editCoupon/:id',couponController.editCouponDetails);
adminRouter.put('/editCoupon/:id',couponController.editCoupon)

module.exports = adminRouter;
