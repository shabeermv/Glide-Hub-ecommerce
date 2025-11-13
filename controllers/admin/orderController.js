const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const statusCode = require("../../utils/statusCodes");

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
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    // 🚫 If order is already delivered, block further changes
    if (order.orderStatus === "Delivered") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "This order has already been delivered and cannot be updated.",
      });
    }

    const validStatuses = ["Pending", "Shipped", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Invalid status provided" });
    }

    // 🟡 Prevent moving backwards (e.g., from Shipped -> Pending)
    const statusOrder = ["Pending", "Shipped", "Delivered", "Cancelled"];
    const currentIndex = statusOrder.indexOf(order.orderStatus);
    const newIndex = statusOrder.indexOf(status);

    if (newIndex < currentIndex) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Cannot change status from ${order.orderStatus} to ${status}.`,
      });
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

    res.status(statusCode.OK).json({
      success: true,
      message: "Order status and product statuses updated successfully",
      order,
    });
  } catch (error) {
    console.log(error.message, "Error updating order status");
    next(error);
  }
};


const viewOrderDetails = async (req, res, next) => {
  const id = req.params.id;
  console.log(id, "Order ID received");

  try {
    const order = await Order.findById(id)
      .populate({
        path: "products.productId",
        select: "title price image category",
        populate: { path: "category", select: "name" },
      })
      .populate({
        path: "userId",
        select: "username email contact address isBlocked",
      })
      .lean();

    if (!order) {
      console.log("Order not found");
      return res
        .status(statusCode.NOT_FOUND)
        .render("admin/error", { message: "Order not found" });
    }

    let offerType = null;
    let offerDetails = null;

    if (order.couponCode) {
      offerType = "Coupon";
      offerDetails = {
        code: order.couponCode,
        discountAmount: order.discountAmount || 0,
      };
    } else {
      const productWithOffer = order.products.find(
        (p) => p.appliedOffer && p.appliedOffer.discountAmount > 0
      );

      if (productWithOffer) {
        offerType =
          productWithOffer.appliedOfferType === "category"
            ? "Category Offer"
            : "Product Offer";
        offerDetails = {
          description: productWithOffer.appliedOffer.description,
          discountAmount: productWithOffer.appliedOffer.discountAmount,
        };
      }
    }

    console.log("Fetched Order with offer info:", offerType, offerDetails);

    res.render("orderDetails", {
      order,
      offerType,
      offerDetails,
    });
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
        .status(statusCode.NOT_FOUND)
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
    res.status(statusCode.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
    res.status(statusCode.INTERNAL_SERVER_ERROR).send("Internal Server Error");
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
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "completed") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Refund cannot be processed. Payment is not completed.",
      });
    }

    const user = order.userId;
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    const productToReturn = order.products.find(
      (p) => String(p.productId._id) === String(productId)
    );

    if (!productToReturn) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: `Product not found in order` });
    }

    if (productToReturn.status === "Returned") {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: `Product has already been returned` });
    }

    let refundAmount = productToReturn.price * productToReturn.quantity;

    if (order.coupon) {
      const coupon = await Coupon.findById(order.coupon);
      if (coupon) {
        if (coupon.discount === "percentage") {
          refundAmount -= (refundAmount * coupon.discountValue) / 100;
        } else if (coupon.discount === "fixed") {
          const totalOrderValue = order.products.reduce(
            (acc, p) => acc + p.price * p.quantity,
            0
          );
          const productShare = refundAmount / totalOrderValue;
          refundAmount -= productShare * coupon.discountValue;
        }
        refundAmount = Math.max(refundAmount, 0);
        console.log(
          `Coupon applied: new refund = ₹${refundAmount.toFixed(2)}`
        );
      }
    }

    if (action === "approved") {
      productToReturn.status = "Returned";

      user.wallet = (user.wallet || 0) + refundAmount;

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount,
        type: "credit",
        description: `Refund for ${productToReturn.productId.title} (Order #${order.orderId})`,
      });

      await user.save();

      const allReturned = order.products.every((p) => p.status === "Returned");
      if (allReturned) {
        order.paymentStatus = "Refunded";
      }
    } else {
      productToReturn.status = "Return Rejected";
    }

    await order.save();

    res.status(statusCode.OK).json({
      success: true,
      message:
        action === "approved"
          ? "Return approved and refund added to wallet successfully"
          : "Return rejected successfully",
      refundAmount: refundAmount.toFixed(2),
      newWalletBalance: user.wallet.toFixed(2),
    });
  } catch (error) {
    console.error("Error processing return request:", error);
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal Server Error" });
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
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    if (order.paymentStatus !== "completed") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Refund cannot be processed. Payment is not completed.",
      });
    }

    const user = order.userId;
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
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
          .status(statusCode.NOT_FOUND)
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
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal Server Error" });
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
