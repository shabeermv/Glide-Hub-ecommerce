const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");

const userOrdersInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the page number from query, default to 1
    const limit = 5; // Number of orders per page
    const skip = (page - 1) * limit; // Calculate the number of orders to skip

    // Fetch total orders count
    const totalOrders = await Order.countDocuments();

    // Fetch orders with pagination
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
      .lean(); // Convert Mongoose documents to plain objects

    // Process orders before sending them to EJS
    const processedOrders = await Promise.all(
      orderData.map(async (order) => {
        // Ensure orderId exists
        if (!order.orderId) {
          order.orderId = `ORD${order._id.toString().slice(-6).toUpperCase()}`;
          await Order.findByIdAndUpdate(order._id, { orderId: order.orderId }); // Save orderId
        }

        // Calculate total amount for the order
        let orderTotal = 0;
        order.products.forEach((product) => {
          if (product.productId && product.productId.price) {
            product.total = product.productId.price * product.quantity;
            orderTotal += product.total;
          }
        });

        // Ensure totalAmount is saved to the database if missing
        if (!order.totalAmount || order.totalAmount <= 0) {
          order.totalAmount = orderTotal;
          await Order.findByIdAndUpdate(order._id, { totalAmount: orderTotal });
        }

        return order;
      })
    );

    // Render the orders page
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
        select: 'username email contact address isBlocked' // Add required fields
      });

    if (!order) {
      console.log('Order not found');
      return res.status(404).render('admin/error', { message: "Order not found" });
    }

    console.log("Fetched Order:", order);

    res.render('orderDetails', { order });
  } catch (error) {
    console.error("Error fetching order:", error.message);
    res.status(500).render('admin/error', { message: "Internal Server Error" });
  }
};






module.exports = {
  userOrdersInfo,
  changeOrderStatus,
  viewOrderDetails
};
