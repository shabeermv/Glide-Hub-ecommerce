const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const userOrdersInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the page number from query, default to 1
    const limit = 5; // Number of orders per page
    const skip = (page - 1) * limit; // Calculate the number of orders to skip

    // Fetch orders with pagination
    const totalOrders = await Order.countDocuments(); // Count total orders
    const orderData = await Order.find({})
      .populate({
        path: "products.productId",
        select: "title price",
      })
      .populate({
        path: "userId",
        select: "name email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Process orders
    const processedOrders = orderData.map((order) => {
      if (!order.orderId) {
        order.orderId = order._id.toString().slice(-6).toUpperCase();
      }

      let orderTotal = 0;
      order.products.forEach((product) => {
        if (product.productId && product.productId.price) {
          product.total = product.productId.price * product.quantity;
          orderTotal += product.total;
        }
      });
      order.totalAmount = orderTotal;

      return order;
    });

    res.render("orders", {
      orderData: processedOrders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit), // Calculate total pages
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
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  userOrdersInfo,
  changeOrderStatus,
};
