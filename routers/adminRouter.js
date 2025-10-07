const express = require("express");
const adminRouter = express.Router();
const adminController = require("../controllers/admin/adminControllers");
const upload = require("../middleware/multer");
const productController = require("../controllers/admin/productControllers");
const customerController = require("../controllers/admin/customerController");
const categoryController = require("../controllers/admin/categoryControllers");
const couponController = require("../controllers/admin/couponController");
const orderController = require("../controllers/admin/orderController");
const middleware = require("../middleware/middlewares");

// Admin routes
adminRouter.get("/adminLogin", adminController.adminLogin);
adminRouter.post("/adminLogin", adminController.postAdmin);
adminRouter.get("/home", middleware.adminAuth, adminController.getHome);
adminRouter.get(
  "/sales-data",
  middleware.adminAuth,
  adminController.getSalesData
);
adminRouter.get("/getReport",middleware.adminAuth,adminController.getReport);
adminRouter.get(
  "/logoutAdmin",
  middleware.adminAuth,
  adminController.logoutAdmin
);
adminRouter.get(
  "/downloadOrdersPDF",
  middleware.adminAuth,
  adminController.downloadOrdersPDF
);
adminRouter.get(
  "/downloadOrdersExcel",
  middleware.adminAuth,
  adminController.downloadOrdersExcel
);
adminRouter.get(
  "/orderFilterByCategory",
  middleware.adminAuth,
  adminController.filterCategoryList
);
adminRouter.get(
  "/filterByDate",
  middleware.adminAuth,
  adminController.getFilterByDate
);

// Product routes
adminRouter.get(
  "/products",
  middleware.adminAuth,
  productController.productsInfo
);
adminRouter.get(
  "/addProduct",
  middleware.adminAuth,
  productController.addProductInfo
);
adminRouter.post(
  "/addProduct",
  middleware.adminAuth,
  upload.array("images", 3),
  productController.productAdd
);
adminRouter.get(
  "/productDetails/:id",
  middleware.adminAuth,
  productController.getProductDeatilsInfo
);
adminRouter.get(
  "/edit/:id",
  middleware.adminAuth,
  productController.renderEditProduct
);
adminRouter.patch(
  "/updateProduct/:id",
  middleware.adminAuth,
  upload.array("images", 3),
  productController.updateProduct
);
adminRouter.put(
  "/delete/:id",
  middleware.adminAuth,
  productController.softDeleteProduct
);
adminRouter.put(
  "/recover/:id",
  middleware.adminAuth,
  productController.recoverProduct
);

// User routes
adminRouter.get("/users", middleware.adminAuth, customerController.userInfo);
adminRouter.patch(
  "/users/block-unblock/:userId",
  middleware.adminAuth,
  middleware.distroyByBlocking,
  customerController.toggleBlockStatus
);

// Category routes
adminRouter.get(
  "/categories",
  middleware.adminAuth,
  categoryController.getCategory
);
adminRouter.post(
  "/addCategory",
  middleware.adminAuth,
  categoryController.addCategory
);
adminRouter.get(
  "/editCategory/:id",
  middleware.adminAuth,
  categoryController.renderEditCategory
);
adminRouter.put(
  "/editCategory/:id",
  middleware.adminAuth,
  categoryController.updateCategory
);
adminRouter.delete(
  "/soft-delete/:id",
  middleware.adminAuth,
  categoryController.deleteCategory
);
adminRouter.put(
  "/toggle-status/:id",
  middleware.adminAuth,
  categoryController.toggleCategoryStatus
);

// Offers
adminRouter.get(
  "/categoryOffer",
  middleware.adminAuth,
  categoryController.viewCategoryOfferInfo
);
adminRouter.post(
  "/addCategoryOffer",
  middleware.adminAuth,
  categoryController.addCategoryOffer
);
adminRouter.delete(
  "/deleteCategoryOffer/:id",
  middleware.adminAuth,
  categoryController.deleteCategoryOffer
);
adminRouter.put(
  "/updateCategoryOffer/:id",
  middleware.adminAuth,
  categoryController.updateCategoryOffer
);
adminRouter.get(
  "/productOffer",
  middleware.adminAuth,
  productController.viewProductOfferInfo
);
adminRouter.post(
  "/addProductOffer",
  middleware.adminAuth,
  productController.addProductOffer
);
adminRouter.delete(
  "/deleteProductOffer/:id",
  middleware.adminAuth,
  productController.deleteProductOffer
);
adminRouter.put(
  "/updateProductOffer/:id",
  middleware.adminAuth,
  productController.editProductOffer
);

// Orders
adminRouter.get(
  "/userOrders",
  middleware.adminAuth,
  orderController.userOrdersInfo
);
adminRouter.post(
  "/orders/update-status",
  middleware.adminAuth,
  orderController.changeOrderStatus
);
adminRouter.get(
  "/orders/:id",
  middleware.adminAuth,
  orderController.viewOrderDetails
);
adminRouter.get(
  "/invoice/:id",
  middleware.adminAuth,
  orderController.getInvoice
);
adminRouter.get(
  "/returnRequests",
  middleware.adminAuth,
  orderController.returnRequests
);
adminRouter.get(
  "/cancelRequests",
  middleware.adminAuth,
  orderController.getCancelRequests
);
adminRouter.post(
  "/returnOrderAction",
  middleware.adminAuth,
  orderController.setUpReturnRequest
);
adminRouter.post("/cancelOrderAction", orderController.setCancelAction);

// Coupons
adminRouter.get(
  "/coupon",
  middleware.adminAuth,
  couponController.couponPageInfo
);
adminRouter.post(
  "/coupons/add",
  middleware.adminAuth,
  couponController.addCoupon
);
adminRouter.delete(
  "/deleteCoupon/:id",
  middleware.adminAuth,
  couponController.deleteCoupon
);
adminRouter.get(
  "/editCoupon/:id",
  middleware.adminAuth,
  couponController.editCouponDetails
);
adminRouter.put(
  "/editCoupon/:id",
  middleware.adminAuth,
  couponController.editCoupon
);

module.exports = adminRouter;
