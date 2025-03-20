const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const userOrdersInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments();

    const orderData = await Order.find({})
      .populate({
        path: "products.productId",
        select: "title price",
      })
      .populate({
        path: "userId",
        select: "username email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); 

    const processedOrders = await Promise.all(
      orderData.map(async (order) => {
        const allReturned = order.products.every(product => product.status === "Returned");
        const anyReturnRequested = order.products.some(product => product.status === "Return Requested");

        if (allReturned) {
          order.orderStatus = "Returned";
          await Order.findByIdAndUpdate(order._id, { orderStatus: "Returned" });
        } else if (anyReturnRequested) {
          order.orderStatus = "Return Requested";
        } else if (order.orderStatus === "Delivered") {
          order.orderStatus = "Delivered";
        }

        return order;
      })
    );

    res.render("orders", {
      orderData: processedOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      isAdmin: true,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.render("orders", {
      orderData: [],
      error: "Unable to fetch orders. Please try again later.",
      isAdmin: true,
    });
  }
};



const changeOrderStatus = async (req, res) => {
  const { orderId, status } = req.body;
  console.log("req.body vannnn", req.body);

  try {
    const order = await Order.findById(orderId);
    console.log("order kittiii", order);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const validStatuses = ["Pending", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status provided" });
    }

    order.orderStatus = status;
    if(order.orderStatus==="Delivered"){
      order.paymentStatus='completed'
    }

    await order.save();

    res
      .status(200)
      .json({
        success: true,
        message: "Order status updated successfully",
        order,
      });
  } catch (error) {
    console.log(error.message, "feeling error in order");
    next(error)
    }
};

const viewOrderDetails = async (req, res) => {
  const id = req.params.id;
  console.log(id, 'Order ID received');

  try {
    const order = await Order.findById(id)
      .populate({
        path: 'products.productId',
        select: 'name price image'
      })
      .populate({
        path: 'userId',
        select: 'username email contact address isBlocked' 
      });

    if (!order) {
      console.log('Order not found');
      return res.status(404).render('admin/error', { message: "Order not found" });
    }

    console.log("Fetched Order:", order);

    res.render('orderDetails', { order });
  } catch (error) {
    console.error("Error fetching order:", error.message);
    next(error)
    }
};

const getInvoice = async(req,res)=>{
  const id = req.params.id;

  try {
    const order = await Order.findById(id)
      .populate({
        path: 'products.productId',
        select: 'title price image'
      })
      .populate({
        path: 'userId',
        select: 'username email contact address'
      });

    if (!order) {
      return res.status(404).render('admin/error', { message: "Order not found" });
    }

    res.render('invoice', { order });

  } catch (error) {
    console.error("Error fetching invoice:", error.message);
    next(error)  }

}



    
const returnRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { orderStatus: "Return Requested" }, 
        { "products.status": "Return Requested" } 
      ]
    })
    .populate("userId")
    .populate("products.productId");

    const returnOrders = [];

    orders.forEach(order => {
      if (order.orderStatus === "Return Requested") {
        returnOrders.push({
          _id: order._id,
          orderId: order.orderId,
          returnReason: order.returnReason || "Not specified",
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          products: order.products.map(product => ({
            ...product._doc,
            isFullOrderReturn: true
          }))
        });
      } 
      else {
        const returnRequestedProducts = order.products.filter(
          product => product.status === "Return Requested"
        );
        
        if (returnRequestedProducts.length > 0) {
          returnOrders.push({
            _id: order._id,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            products: returnRequestedProducts
          });
        }
      }
    });

    res.render("ReturnRequest", { returnOrders });
  } catch (error) {
    console.error("Error fetching return requests:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getCancelRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { orderStatus: "Cancel Requested" }, 
        { "products.status": "Cancel Requested" }
      ]
    })
    .populate("userId")
    .populate("products.productId");

    const returnOrders = [];

    orders.forEach(order => {
      if (order.orderStatus === "Cancel Requested") {
        returnOrders.push({
          _id: order._id,
          orderId: order.orderId,
          returnReason: order.returnReason || "Not specified",
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          products: order.products.map(product => ({
            ...product._doc,
            isFullOrderReturn: true,
            returnReason: order.returnReason || product.returnReason || "Not specified"
          }))
        });
      } else {
        const returnRequestedProducts = order.products.filter(
          product => product.status === "Cancel Requested"
        );

        if (returnRequestedProducts.length > 0) {
          returnOrders.push({
            _id: order._id,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            products: returnRequestedProducts.map(product => ({
              ...product._doc,
              isFullOrderReturn: false,
              returnReason: product.returnReason || "Not specified"
            }))
          });
        }
      }
    });

    console.log("Return Orders Data:", returnOrders); // Debugging
    res.render("cancelRequests", { returnOrders });

  } catch (error) {
    console.error("Error fetching return requests:", error);
    res.status(500).send("Internal Server Error");
  }
};

const setUpReturnRequest = async (req, res) => {
  try {
    const { orderId, productOrderId, action, isFullOrder } = req.body;

    const order = await Order.findById(orderId).populate("userId");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const user = order.userId; 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let refundAmount = 0;

    if (isFullOrder) {
      if (action === "approved") {
        order.orderStatus = "Returned";

        order.products.forEach(product => {
          product.status = "Returned";
          refundAmount += product.price * product.quantity;  
        });
      } else {
        order.orderStatus = "Return Rejected";

        order.products.forEach(product => {
          product.status = "Return Rejected";
        });
      }
    } else {
      const productIndex = order.products.findIndex(p => p.productOrderId === productOrderId);

      if (productIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Product not found in order"
        });
      }

      const returnedProduct = order.products[productIndex];

      if (action === "approved") {
        returnedProduct.status = "Returned";
        refundAmount = returnedProduct.price * returnedProduct.quantity; 
      } else {
        returnedProduct.status = "Return Rejected";
      }

      // ✅ Check if all products are returned or rejected
      const allReturned = order.products.every(p => p.status === "Returned");
      const allRejected = order.products.every(p => p.status === "Return Rejected");

      if (allReturned) {
        order.orderStatus = "Returned";
      } else if (allRejected) {
        order.orderStatus = "Return Rejected";
      }
    }

    if (action === "approved" && refundAmount > 0) {
      user.wallet += refundAmount;

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount
      });

      await user.save();
    }

    await order.save();

    res.json({ success: true, refundAmount });

  } catch (error) {
    console.error("Error handling return action:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};
const setCancelAction = async(req,res)=>{
  try {
    const { orderId, productOrderId, action, isFullOrder } = req.body;

    const order = await Order.findById(orderId).populate("userId");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const user = order.userId; 
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let refundAmount = 0;

    if (isFullOrder) {
      if (action === "approved") {
        order.orderStatus = "Cancelled";

        order.products.forEach(product => {
          product.status = "Cancelled";
          refundAmount += product.price * product.quantity;  
        });
      } else {
        order.orderStatus = "Cancel Rejected";

        order.products.forEach(product => {
          product.status = "Cancel Rejected";
        });
      }
    } else {
      const productIndex = order.products.findIndex(p => p.productOrderId === productOrderId);

      if (productIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Product not found in order"
        });
      }

      const returnedProduct = order.products[productIndex];

      if (action === "approved") {
        returnedProduct.status = "Cancelled";
        refundAmount = returnedProduct.price * returnedProduct.quantity; 
      } else {
        returnedProduct.status = "Cancel Rejected";
      }

      // ✅ Check if all products are returned or rejected
      const allReturned = order.products.every(p => p.status === "Cancelled");
      const allRejected = order.products.every(p => p.status === "Cancel Rejected");

      if (allReturned) {
        order.orderStatus = "Cancelled";
      } else if (allRejected) {
        order.orderStatus = "Cancel Rejected";
      }
    }

    if (action === "approved" && refundAmount > 0) {
      user.wallet += refundAmount;

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount
      });

      await user.save();
    }

    await order.save();

    res.json({ success: true, refundAmount });

  } catch (error) {
    console.error("Error handling return action:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }

}










module.exports = {
  userOrdersInfo,
  changeOrderStatus,
  viewOrderDetails,
  getInvoice,
  returnRequests,
  getCancelRequests,
  setUpReturnRequest,
  setCancelAction
};
