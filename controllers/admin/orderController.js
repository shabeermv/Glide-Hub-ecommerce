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
        // Check product statuses
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
// const approveReturn = async (req, res, next) => {
//   try {
//       const { orderId, action } = req.body; 

//       const order = await Order.findById(orderId);
//       if (!order) {
//           return res.status(404).json({ success: false, message: 'Order not found' });
//       }

//       if (order.orderStatus !== 'Return Requested') {
//           return res.status(400).json({ success: false, message: 'No pending return request' });
//       }

//       if (action === 'approve') {
//           order.orderStatus = 'Returned';
//       } else if (action === 'reject') {
//           order.orderStatus = 'Rejected';
//       } else {
//           return res.status(400).json({ success: false, message: 'Invalid action' });
//       }

//       await order.save();
//       return res.status(200).json({ success: true, message: `Return request ${action}d successfully` });

//   } catch (error) {
//       console.log('Error approving return request:', error);
//       next(error);
//   }
// };



    
const returnRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { orderStatus: "Return Requested" }, // Full order return
        { "products.status": "Return Requested" } // Individual product return
      ]
    })
    .populate("userId")
    .populate("products.productId");

    // Format orders for display
    const returnOrders = [];

    orders.forEach(order => {
      // Case 1: Full order return
      if (order.orderStatus === "Return Requested") {
        // Create an entry with all products from the order
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
      // Case 2: Individual product returns
      else {
        // Filter only products with "Return Requested" status
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

const setUpReturnRequest = async (req, res) => {
  try {
    const { orderId, productOrderId, action, isFullOrder } = req.body;

    // Fetch the order
    const order = await Order.findById(orderId).populate("userId");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const user = order.userId; // Since `userId` is populated, it's now the user document
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let refundAmount = 0;

    if (isFullOrder) {
      // ✅ Full Order Return
      if (action === "approved") {
        order.orderStatus = "Returned";

        order.products.forEach(product => {
          product.status = "Returned";
          refundAmount += product.price * product.quantity; // Calculate total refund
        });
      } else {
        order.orderStatus = "Return Rejected";

        order.products.forEach(product => {
          product.status = "Return Rejected";
        });
      }
    } else {
      // ✅ Single Product Return
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
        refundAmount = returnedProduct.price * returnedProduct.quantity; // Refund only this product
      } else {
        returnedProduct.status = "Return Rejected";
      }
    }

    // ✅ Process Refund to Wallet if Approved
    if (action === "approved" && refundAmount > 0) {
      user.wallet += refundAmount; // Add refund to user's wallet

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount
      });

      await user.save(); // Save user wallet update
    }

    await order.save(); // Save updated order status

    res.json({ success: true, refundAmount });

  } catch (error) {
    console.error("Error handling return action:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
};











module.exports = {
  userOrdersInfo,
  changeOrderStatus,
  viewOrderDetails,
  getInvoice,
  // approveReturn,
  returnRequests,
  setUpReturnRequest
};
