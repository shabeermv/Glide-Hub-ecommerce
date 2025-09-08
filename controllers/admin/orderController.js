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
        const allReturned = order.products.every(
          (product) => product.status === "Returned"
        );
        const anyReturnRequested = order.products.some(
          (product) => product.status === "Return Requested"
        );

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

const changeOrderStatus = async (req, res, next) => {
  const { orderId, status } = req.body;
  console.log("req.body received:", req.body);

  try {
    const order = await Order.findById(orderId);
    console.log("Order found:", order);

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

    if (status === "Delivered") {
      order.paymentStatus = "completed";
    }

    order.products.forEach((product) => {
      if (status === "Cancelled") {
        product.status = "Cancelled";
      } else if (status === "Shipped") {
        product.status = "Shipped";
      } else if (status === "Delivered") {
        product.status = "Delivered";
      }
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: "Order status and product statuses updated successfully",
      order,
    });
  } catch (error) {
    console.log(error.message, "Error updating order status");
    next(error);
  }
};

const viewOrderDetails = async (req, res) => {
  const id = req.params.id;
  console.log(id, "Order ID received");

  try {
    const order = await Order.findById(id)
      .populate({
        path: "products.productId",
        select: "name price image",
      })
      .populate({
        path: "userId",
        select: "username email contact address isBlocked",
      });

    if (!order) {
      console.log("Order not found");
      return res
        .status(404)
        .render("admin/error", { message: "Order not found" });
    }

    console.log("Fetched Order:", order);

    res.render("orderDetails", { order });
  } catch (error) {
    console.error("Error fetching order:", error.message);
    next(error);
  }
};

const getInvoice = async (req, res) => {
  const id = req.params.id;

  try {
    const order = await Order.findById(id)
      .populate({
        path: "products.productId",
        select: "title price image",
      })
      .populate({
        path: "userId",
        select: "username email contact address",
      });

    if (!order) {
      return res
        .status(404)
        .render("admin/error", { message: "Order not found" });
    }

    res.render("invoice", { order });
  } catch (error) {
    console.error("Error fetching invoice:", error.message);
    next(error);
  }
};

const returnRequests = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { orderStatus: "Return Requested" },
        { "products.status": "Return Requested" },
      ],
    })
      .populate("userId")
      .populate("products.productId");

    const returnOrders = [];

    orders.forEach((order) => {
      if (order.orderStatus === "Return Requested") {
        returnOrders.push({
          _id: order._id,
          orderId: order.orderId,
          returnReason: order.returnReason || "Not specified",
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          products: order.products.map((product) => ({
            ...product._doc,
            isFullOrderReturn: true,
          })),
        });
      } else {
        const returnRequestedProducts = order.products.filter(
          (product) => product.status === "Return Requested"
        );

        if (returnRequestedProducts.length > 0) {
          returnOrders.push({
            _id: order._id,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            products: returnRequestedProducts,
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
        { products: { $elemMatch: { status: "Cancel Requested" } } },
      ],
    })
      .populate("userId")
      .populate("products.productId");

    const cancelRequests = [];

    orders.forEach((order) => {
      if (order.orderStatus === "Cancel Requested") {
        cancelRequests.push({
          _id: order._id,
          orderId: order.orderId,
          cancelReason: order.cancelReason || "Not specified",
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          products: order.products.map((product) => ({
            ...product._doc,
            isFullOrderCancel: true,
            cancelReason:
              order.cancelReason || product.cancelReason || "Not specified",
          })),
        });
      } else {
        const cancelRequestedProducts = order.products.filter(
          (product) => product.status === "Cancel Requested"
        );

        if (cancelRequestedProducts.length > 0) {
          cancelRequests.push({
            _id: order._id,
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt,
            products: cancelRequestedProducts.map((product) => ({
              ...product._doc,
              isFullOrderCancel: false,
              cancelReason: product.cancelReason || "Not specified",
            })),
          });
        }
      }
    });

    console.log("Cancel Requests Data:", cancelRequests);
    res.render("cancelRequests", { cancelRequests });
  } catch (error) {
    console.error("Error fetching cancel requests:", error);
    res.status(500).send("Internal Server Error");
  }
};

const setUpReturnRequest = async (req, res) => {
  try {
    const { orderId, productId, action } = req.body;
    console.log("Processing return request:", { orderId, productId, action });

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("products.productId")
      .populate("coupon");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "completed") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Refund cannot be processed. Payment is not completed.",
        });
    }

    const user = order.userId;
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const productToReturn = order.products.find(
      (p) => String(p.productId._id) === String(productId)
    );

    if (!productToReturn) {
      return res
        .status(404)
        .json({ success: false, message: `Product not found in order` });
    }

    if (productToReturn.status === "Returned") {
      return res
        .status(400)
        .json({ success: false, message: `Product has already been returned` });
    }

    let refundAmount = productToReturn.price * productToReturn.quantity;

    if (order.coupon) {
      const coupon = await Coupon.findById(order.coupon);
      if (coupon) {
        if (coupon.discount === "percentage") {
          refundAmount -= (refundAmount * coupon.discountValue) / 100;
        } else if (coupon.discount === "fixed") {
          const productShare = refundAmount / order.totalAmount;
          refundAmount -= productShare * coupon.discountValue;
        }
        console.log(
          `Applying ${coupon.discountValue}${
            coupon.discount === "percentage" ? "%" : "₹"
          } discount. New refund: ₹${refundAmount}`
        );
      }
    }

    if (action === "approved") {
      productToReturn.status = "Returned";
      user.wallet += refundAmount;

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount,
        description: `Refund for product: ${productToReturn.productId.title} (Order #${order.orderId})`,
      });

      await user.save();
    } else {
      productToReturn.status = "Return Rejected";
    }

    await order.save();

    res.status(200).json({
      success: true,
      message:
        action === "approved"
          ? "Return approved and refunded successfully"
          : "Return rejected successfully",
      refundAmount,
    });
  } catch (error) {
    console.error("Error processing return request:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const setCancelAction = async (req, res) => {
  try {
    const { orderId, productOrderId, action, isFullOrder } = req.body;

    const order = await Order.findById(orderId)
      .populate("userId")
      .populate("coupon");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "completed") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Refund cannot be processed. Payment is not completed.",
        });
    }

    const user = order.userId;
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let refundAmount = 0;

    const coupon = order.coupon ? await Coupon.findById(order.coupon) : null;
    const discountType = coupon ? coupon.discount : null;
    const discountValue = coupon ? coupon.discountValue : 0;

    if (isFullOrder) {
      if (action === "approved") {
        order.orderStatus = "Cancelled";

        order.products.forEach((product) => {
          product.status = "Cancelled";
          let refund = product.price * product.quantity;

          if (coupon) {
            if (discountType === "percentage") {
              refund -= (refund * discountValue) / 100;
            } else if (discountType === "fixed") {
              const productShare = refund / order.totalAmount;
              refund -= productShare * discountValue;
            }
          }

          refundAmount += refund;
        });
      } else {
        order.orderStatus = "Cancel Rejected";
        order.products.forEach((product) => {
          product.status = "Cancel Rejected";
        });
      }
    } else {
      const productIndex = order.products.findIndex(
        (p) => p.productId && p.productId._id.toString() === productOrderId
      );

      if (productIndex === -1) {
        return res
          .status(404)
          .json({ success: false, message: "Product not found in order" });
      }

      const returnedProduct = order.products[productIndex];

      if (action === "approved") {
        returnedProduct.status = "Cancelled";
        let refund = returnedProduct.price * returnedProduct.quantity;

        if (coupon) {
          if (discountType === "percentage") {
            refund -= (refund * discountValue) / 100;
          } else if (discountType === "fixed") {
            const productShare = refund / order.totalAmount;
            refund -= productShare * discountValue;
          }
        }

        refundAmount = refund;
      } else {
        returnedProduct.status = "Cancel Rejected";
      }

      const allReturned = order.products.every((p) => p.status === "Cancelled");
      const allRejected = order.products.every(
        (p) => p.status === "Cancel Rejected"
      );

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
        amount: refundAmount,
        type: "credit",
        description: `Refund for cancelled order #${order.orderId}`,
      });

      await user.save();
    }

    await order.save();

    res.json({ success: true, refundAmount });
  } catch (error) {
    console.error("Error handling cancel action:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  userOrdersInfo,
  changeOrderStatus,
  viewOrderDetails,
  getInvoice,
  returnRequests,
  getCancelRequests,
  setUpReturnRequest,
  setCancelAction,
};
