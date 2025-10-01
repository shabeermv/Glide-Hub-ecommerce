const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const CategoryOffer = require("../../models/categoryOffer");
const ProductOffer = require("../../models/productOffer");
const Coupon = require("../../models/couponSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const statusCode = require("../../utils/statusCodes")

const checkoutPageInfo = async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.id;

  try {
    const user = await User.findById(userId);

    let products = [];
    let totalPrice = 0;

    if (productId) {
      const product = await Product.findById(productId).populate("category");
      if (!product) {
        return res.status(statusCode.NOT_FOUND).render("checkout", {
          error: "Product not found",
          products: [],
          user: {
            email: user.email,
            username: user.username,
            contact: user.contact,
            address: user.address?.length > 0 ? user.address[0] : null,
          },
        });
      }

      const productOffer = await ProductOffer.findOne({ productId });
      const categoryOffer = await CategoryOffer.findOne({
        categoryId: product.category._id,
      });

      let finalPrice = product.price;
      let appliedOffer = null;

      if (productOffer) {
        finalPrice =
          productOffer.discountType === "percentage"
            ? product.price - (product.price * productOffer.discountValue) / 100
            : product.price - productOffer.discountValue;
        appliedOffer = productOffer;
      } else if (categoryOffer) {
        finalPrice =
          categoryOffer.discountType === "percentage"
            ? product.price -
              (product.price * categoryOffer.discountValue) / 100
            : product.price - categoryOffer.discountValue;
        appliedOffer = categoryOffer;
      }

      const cart = await Cart.findOne({ userId });
      const cartItem = cart
        ? cart.product.find((item) => item.productId.toString() === productId)
        : null;

      products = [
        {
          productId: product._id,
          title: product.title,
          originalPrice: product.price,
          discountedPrice: finalPrice,
          hasDiscount: appliedOffer !== null,
          appliedOffer,
          price: finalPrice,
          quantity: cartItem ? cartItem.quantity : 1,
          size: cartItem ? cartItem.size : "M",
          totalPrice: finalPrice * (cartItem ? cartItem.quantity : 1),
          image:
            product.image?.length > 0
              ? product.image[0]
              : "default-product.jpg",
        },
      ];
      totalPrice = finalPrice * (cartItem ? cartItem.quantity : 1);
    } else {
      const cart = await Cart.findOne({ userId }).populate(
        "product.productId",
        "title price image category hasDiscount discountedPrice"
      );

      if (!cart || !cart.product || cart.product.length === 0) {
        return res.status(statusCode.BAD_REQUEST).render("checkout", {
          error: "Your cart is empty",
          products: [],
          user: {
            email: user.email,
            username: user.username,
            contact: user.contact,
            address: user.address?.length > 0 ? user.address[0] : null,
          },
        });
      }

      products = await Promise.all(
        cart.product.map(async (item) => {
          const product = item.productId;
          let finalPrice = product.hasDiscount
            ? product.discountedPrice
            : product.price;
          let appliedOffer = null;

          const categoryOffer = await categoryOffer.findOne({
            categoryId: product.category,
          });

          const productOffer = await productOffer.findOne({
            productId: product._id,
          });

          if (productOffer) {
            finalPrice =
              productOffer.discountType === "percentage"
                ? product.price -
                  (product.price * productOffer.discountValue) / 100
                : product.price - productOffer.discountValue;
            appliedOffer = productOffer;
          } else if (categoryOffer) {
            finalPrice =
              categoryOffer.discountType === "percentage"
                ? product.price -
                  (product.price * categoryOffer.discountValue) / 100
                : product.price - categoryOffer.discountValue;
            appliedOffer = categoryOffer;
          }

          return {
            productId: product._id,
            title: product.title,
            originalPrice: product.price,
            discountedPrice: finalPrice,
            hasDiscount: appliedOffer !== null,
            appliedOffer,
            price: finalPrice,
            quantity: item.quantity,
            size: item.size,
            totalPrice: finalPrice * item.quantity,
            image:
              product.image?.length > 0
                ? product.image[0]
                : "default-product.jpg",
          };
        })
      );

      totalPrice = products.reduce(
        (sum, product) => sum + product.totalPrice,
        0
      );
    }

    const applicableCoupons = await Coupon.find({
      minPurchase: { $lte: totalPrice },
      expireDate: { $gte: new Date() },
    });

    const defaultAddress = user.address?.length > 0 ? user.address[0] : null;

    res.render("checkout", {
      products,
      totalPrice,
      applicableCoupons,
      user: {
        email: user.email,
        username: user.username,
        contact: user.contact,
        address: defaultAddress,
      },
    });
  } catch (error) {
    console.error("Error fetching checkout data:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "internal server error" });
  }
};

const cartCheckoutPage = async (req, res, next) => {
  const userId = req.session.userId;

  try {
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "product.productId",
      select:
        "title price image category hasDiscount originalPrice discountedPrice",
      populate: {
        path: "category",
        select: "_id",
      },
    });

    if (!cart || !cart.product || cart.product.length === 0) {
      return res.status(statusCode.BAD_REQUEST).render("checkout", {
        error: "Your cart is empty",
        products: [],
        totalPrice: 0,
        user: {
  email: user.email,
  username: user.username,
  contact: user.contact,
  address: user.address || [],   // send the array
}
      });
    }

    let totalPrice = 0;
    const products = await Promise.all(
      cart.product.map(async (item) => {
        const product = item.productId;
        const originalPrice = product.originalPrice || product.price || 0;

        const productOfferDoc = await ProductOffer.findOne({
          productId: product._id,
        });

        let categoryOfferDoc = null;
        if (product.category && product.category._id) {
          categoryOfferDoc = await CategoryOffer.findOne({
            categoryId: product.category._id,
          });
        }

        let finalPrice = originalPrice;
        let appliedOffer = null;

        if (productOfferDoc) {
          finalPrice =
            productOfferDoc.discountType === "percentage"
              ? originalPrice -
                (originalPrice * productOfferDoc.discountValue) / 100
              : originalPrice - productOfferDoc.discountValue;
          appliedOffer = productOfferDoc;
        } else if (categoryOfferDoc) {
          finalPrice =
            categoryOfferDoc.discountType === "percentage"
              ? originalPrice -
                (originalPrice * categoryOfferDoc.discountValue) / 100
              : originalPrice - categoryOfferDoc.discountValue;
          appliedOffer = categoryOfferDoc;
        } else if (product.hasDiscount) {
          finalPrice = product.discountedPrice;
        }

        const totalItemPrice = finalPrice * item.quantity;
        totalPrice += totalItemPrice;

        return {
          productId: product._id,
          title: product.title,
          hasDiscount: appliedOffer !== null || product.hasDiscount,
          originalPrice: originalPrice.toFixed(2),
          discountedPrice: finalPrice.toFixed(2),
          appliedOffer,
          quantity: item.quantity,
          size: item.size,
          totalPrice: totalItemPrice.toFixed(2),
          image: product.image?.[0] || "default-product.jpg",
        };
      })
    );

    const defaultAddress = user.address?.length > 0 ? user.address[0] : null;
    const applicableCoupons = await Coupon.find({
      minPurchase: { $lte: totalPrice },
      expireDate: { $gte: new Date() },
    });

    res.render("checkout", {
      products,
      totalPrice: totalPrice.toFixed(2),
      applicableCoupons,
      breadcrumbs:[
        {name:"Home",url:"/"},
        {name:"Shop",url:"/shop"},
        {name:"Cart",url:"/cart"},
        {name:"Checkout"}

      ],
     user: {
  email: user.email,
  username: user.username,
  contact: user.contact,
  address: user.address || [],   
},
      paymentError: req.query.error === "payment" ? true : false,
      errorMessage:
        req.query.error === "payment"
          ? "Your payment was not successful. Please try again or select another payment method."
          : "",
    });
  } catch (error) {
    console.error("Error fetching cart checkout data:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).render("error", {
      error: error.message,
      user: req.session.userId ? { username: "User" } : null,
    });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal } = req.body;

    if (!couponCode || !subtotal) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Coupon code and subtotal are required",
      });
    }

    const coupon = await Coupon.findOne({
      code: couponCode,
      expireDate: { $gt: new Date() },
    });

    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }

    if (coupon.minPurchase && subtotal < coupon.minPurchase) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`,
      });
    }

    if (coupon.count !== undefined && coupon.count <= 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "This coupon has reached its usage limit",
      });
    }

    let discount = 0;
    if (coupon.discount === "percentage") {
      discount = (subtotal * coupon.discountValue) / 100;
    } else {
      discount = coupon.discountValue;
    }

    discount = parseFloat(discount.toFixed(2)); 

    let discountedTotal = Math.max(0, subtotal - discount);
    discountedTotal = parseFloat(discountedTotal.toFixed(2)); 

    res.status(statusCode.OK).json({
      success: true,
      discount: discount,
      discountedTotal: discountedTotal,
      couponCode: couponCode,
      message: `Coupon applied! You saved ₹${discount.toFixed(2)}`,
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};

const generateOrderId = () => {
  const timestamp = Date.now().toString();
  const randomNum = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD${timestamp}${randomNum}`;
};

const buyNow = async (req, res) => {
  try {
    const userId = req.session.userId;
    const formData = req.body;

    const couponCode = formData.couponCode || "";
    const couponDiscount = parseFloat(formData.couponDiscount || 0);

    const cart = await Cart.findOne({ userId }).populate("product.productId");

    if (!cart || !cart.product || cart.product.length === 0) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "No items in cart" });
    }

    
    for (const item of cart.product) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        return res
          .status(statusCode.BAD_REQUEST)
          .json({ success: false, message: `Product not found` });
      }

      const sizeInfo = product.sizes.find(s => s.size === item.size);
      if (!sizeInfo || sizeInfo.stock < item.quantity) {
        return res
          .status(statusCode.BAD_REQUEST)
          .json({ 
            success: false, 
            message: `Insufficient stock for ${product.title} in size ${item.size}. Available: ${sizeInfo ? sizeInfo.stock : 0}, Requested: ${item.quantity}` 
          });
      }
    }

    
    const subtotal = cart.product.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const finalAmount = Math.max(0, subtotal - couponDiscount);

    
    if (formData.paymentMethod && formData.paymentMethod.toLowerCase().includes("wallet")) {
      const user = await User.findById(userId);
      if (!user || user.wallet < finalAmount) {
        return res
          .status(statusCode.BAD_REQUEST)
          .json({ success: false, message: "Insufficient wallet balance" });
      }
    }

    
    const shippingAddress = {
      fullName: `${formData.firstName} ${formData.lastName}`,
      address:
        formData.streetAddress +
        (formData.landmark ? `, ${formData.landmark}` : ""),
      city: formData.city,
      state: formData.state,
      postalCode: formData.postCode,
      country: formData.country,
      phone: formData.phone,
    };

    
    const orderProducts = cart.product.map((item) => ({
      productId: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    }));

    
    let paymentMethod = formData.paymentMethod;
    if (typeof paymentMethod === "string") {
      if (paymentMethod.toLowerCase().includes("wallet")) {
        paymentMethod = "wallet";
      } else if (paymentMethod.toLowerCase().includes("razorpay")) {
        paymentMethod = "razorpay";
      } else if (
        paymentMethod.toLowerCase().includes("cod") ||
        paymentMethod.toLowerCase().includes("cash on delivery")
      ) {
        paymentMethod = "cod";
      }
    }

    
    const newOrder = new Order({
      orderId: generateOrderId(),
      userId: userId,
      products: orderProducts,
      orderStatus: "Confirmed",
      shippingAddress: shippingAddress,
      paymentMethod: [paymentMethod],
      paymentStatus: paymentMethod === "wallet" ? "completed" : "Pending",
      totalAmount: finalAmount,
      couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
      couponCode: couponCode || undefined,
    });

    await newOrder.save();

    
    if (paymentMethod === "wallet") {
      const user = await User.findById(userId);
      if (user) {
        user.wallet -= finalAmount;
        user.walletHistory.push({
          date: new Date(),
          amount: -finalAmount,
          description: `Order payment - ${newOrder.orderId}`,
          type: "debit",
        });
        await user.save();
      }
    }

    
    for (const item of cart.product) {
      const updateResult = await Product.updateOne(
        {
          _id: item.productId._id,
          "sizes.size": item.size,
          "sizes.stock": { $gte: item.quantity },
        },
        {
          $inc: {
            "sizes.$.stock": -item.quantity,
            saleCount: item.quantity,
            totalStock: -item.quantity,
          },
        }
      );

      if (updateResult.modifiedCount === 0) {
        console.error(
          `Failed to update stock for product ${item.productId._id}, size ${item.size}`
        );
      } else {
        
        const updatedProduct = await Product.findById(item.productId._id);
        updatedProduct.totalStock = updatedProduct.sizes.reduce(
          (sum, s) => sum + s.stock,
          0
        );
        await updatedProduct.save();
      }
    }

    
    await Cart.findOneAndUpdate(
      { userId: userId },
      { $set: { product: [], totalPrice: 0 } }
    );

    res.status(statusCode.OK).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
      finalAmount: finalAmount.toFixed(2),
    });
  } catch (error) {
    console.error("Error in buyNow controller:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;
    const { reason, additionalDetails } = req.body;
    console.log(req.body, "this is the body..");

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      });
    }

    for (const item of order.products) {
      const product = await Product.findById(item.productId);

      if (product) {
        product.saleCount = Math.max(0, (product.saleCount || 0) - 1);

        if (!Array.isArray(product.sizes)) {
          console.warn(`Product ${product._id} has no sizes array`);
          continue;
        }

        const sizeIndex = product.sizes.findIndex(
          (sizeObj) => sizeObj.size === item.size
        );

        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock += item.quantity;
        } else {
          product.sizes.push({
            size: item.size,
            stock: item.quantity,
          });
        }

        await product.save();
      }
    }

    order.products.forEach((product) => {
      product.status = "Cancelled";
    });

    order.cancellationReason = reason;
    if (additionalDetails) {
      order.cancelDetails = additionalDetails;
    }

    order.markModified("products");
    order.orderStatus = "Cancelled";

    await order.save();

    res.status(statusCode.OK).json({
      success: true,
      message: "Order cancelled successfully",
      refunded: order.paymentStatus === "completed" ? order.totalAmount : 0,
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const viewPurchaseDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;

    const order = await Order.findById(orderId)
      .populate({
        path: "products.productId",
        select: "title price image",
      })
      .populate("userId", "username email contact");

    if (!order) {
      return res.status(statusCode.NOT_FOUND).render("error", {
        message: "Order not found",
      });
    }

    if (order.userId._id.toString() !== userId) {
      return res.status(statusCode.FORBIDDEN).render("error", {
        message: "Unauthorized access to order",
      });
    }

    res.render("purchaseDetails", {
      order: order,
      user: order.userId,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const cancelPartialProduct = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { productId, reason, customReason, quantity = 1 } = req.body;

    console.log(
      `Processing cancellation for Order ID: ${orderId}, Product ID: ${productId}, Quantity: ${quantity}`
    );
    console.log(`Reason: ${reason}, Details: ${customReason}`);

    if (!orderId || !productId) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Missing required fields." });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found." });
    }

    if (!Array.isArray(order.products) || order.products.length === 0) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "No products found in order." });
    }

    const product = order.products.find(
      (p) => p.productId.toString() === productId
    );

    if (!product) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Product not found in order." });
    }

    console.log(" Product found in order:", product);

    if (["Cancel Requested", "Cancelled"].includes(product.status)) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Product already cancelled." });
    }

    if (quantity > product.quantity) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Invalid quantity. You can't cancel more than the ordered quantity (${product.quantity}).`,
      });
    }

    if (quantity < product.quantity) {
      product.cancelledQuantity = quantity;
      product.status = "Cancelled";
      product.cancelReason = reason || "Not specified";
      product.cancelDetails = customReason || "";
      product.cancelRequestDate = new Date();
      order.markModified("products");

      const productData = await Product.findById(productId);
      if (productData && Array.isArray(productData.sizes)) {
        const sizeObj = productData.sizes.find((s) => s.size === product.size);
        if (sizeObj) {
          sizeObj.stock += quantity;
        } else {
          console.warn(
            `Size ${product.size} not found for Product ${productData._id}`
          );
        }
        await productData.save();
      }
    } else {
      product.status = "Cancelled";
      product.cancelReason = reason || "Not specified";
      product.cancelDetails = customReason || "";
      product.cancelRequestDate = new Date();
      order.markModified("products");

      const productData = await Product.findById(productId);
      if (productData && Array.isArray(productData.sizes)) {
        const sizeObj = productData.sizes.find((s) => s.size === product.size);
        if (sizeObj) {
          sizeObj.stock += product.quantity;
        } else {
          console.warn(
            `Size ${product.size} not found for Product ${productData._id}`
          );
        }
        await productData.save();
      }
    }

    const allCancelled = order.products.every(
      (p) =>
        ["Cancel Requested", "Cancelled"].includes(p.status) ||
        (p.cancelledQuantity && p.cancelledQuantity === p.quantity)
    );

    if (allCancelled) {
      order.orderStatus = "Cancelled";
      order.cancelReason = reason || "All products cancelled";
      order.cancelDetails = customReason || "";
      order.cancelRequestDate = new Date();
    }

    await order.save();

    return res.status(statusCode.OK).json({
      success: true,
      message:
        quantity < product.quantity
          ? `${quantity} items requested for cancellation.`
          : "Product cancellation requested successfully.",
    });
  } catch (error) {
    console.error("Error in cancelPartialProduct:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error." });
  }
};
const orderCancel = async (req, res) => {
  const orderId = req.params.id;
  const { reason, additionalDetails } = req.body;

  console.log("Cancelling order with ID:", orderId);
  console.log(`Reason: ${reason}, Details: ${additionalDetails}`);

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    let hasUpdatedProduct = false;

    for (const product of order.products) {
      if (
        product.status === "Cancelled" ||
        product.status === "Cancel Requested"
      ) {
        console.log(
          `Skipping product ${product.productId} as it is already cancelled or cancel requested.`
        );
        continue;
      }

      product.status = "Cancelled";
      product.cancelReason = reason || "Order cancelled";
      product.cancelDetails = additionalDetails || "";
      product.cancelRequestDate = new Date();
      order.markModified("products");
      hasUpdatedProduct = true;

      const productData = await Product.findById(product.productId);
      if (productData) {
        if (!Array.isArray(productData.sizes)) {
          console.warn(`Product ${productData._id} has no sizes array`);
        } else {
          const sizeObj = productData.sizes.find(
            (sizeObj) => sizeObj.size === product.size
          );
          if (sizeObj) {
            sizeObj.stock += product.quantity;
          } else {
            console.warn(
              `Size ${product.size} not found for Product ${productData._id}`
            );
          }
        }

        await productData.save();
      }
    }

    if (hasUpdatedProduct) {
      order.orderStatus = "Cancelled";
      order.cancelReason = reason || "Not specified";
      order.cancelDetails = additionalDetails || "";
      order.cancelRequestDate = new Date();
      order.markModified("orderStatus");

      await order.save();

      return res
        .status(statusCode.OK)
        .json({
          success: true,
          message: "Order cancellation request submitted successfully",
        });
    } else {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({
          success: false,
          message:
            "All products are already cancelled or in cancel requested state",
        });
    }
  } catch (error) {
    console.error("Error in orderCancel:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

//   console.log('Environment variables check:');
// console.log('RAZOPAY_ID_KEY:', process.env.RAZORPAY_ID_KEY);
// console.log('RAZOPAY_SECRET_KEY:', process.env.RAZORPAY_SECRET_KEY);

const razorpayCreation = async (req, res) => {
  try {
    const { orderId, totalAmount, couponDiscount = 0 } = req.body;
    let order;

    if (orderId) {
      order = await Order.findById(orderId);
      if (!order) {
        return res
          .status(statusCode.NOT_FOUND)
          .json({ success: false, message: "Order not found" });
      }
    } else {
      const userId = req.session.userId || null;
      let subtotal = parseFloat(totalAmount || 0);
      let finalAmount = Math.max(0, subtotal - parseFloat(couponDiscount));

      let cart = null;
      if (userId) {
        cart = await Cart.findOne({ userId }).populate("product.productId");
      }

      if (!subtotal && cart && cart.product.length > 0) {
        subtotal = cart.product.reduce((total, item) => {
          const price = item.productId.hasDiscount
            ? item.productId.discountedPrice
            : item.productId.originalPrice || item.productId.price;
          return total + price * item.quantity;
        }, 0);
      }

      if (!subtotal) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Unable to determine order amount. Please try again.",
        });
      }

      let user = userId ? await User.findById(userId) : null;
      let shippingAddress = {
        fullName: user
          ? user.username
          : req.body.firstName + " " + req.body.lastName,
        email: user ? user.email : req.body.email,
        phone: user ? user.contact || req.body.phone : req.body.phone,
        address: user?.address?.[0]?.address || req.body.streetAddress,
        city: req.body.city || user?.address?.[0]?.city,
        state: req.body.state || user?.address?.[0]?.state,
        postalCode: req.body.postCode || user?.address?.[0]?.postCode,
        country: req.body.country || user?.address?.[0]?.country,
      };

      let orderProducts = cart?.product.map((item) => ({
        productId: item.productId._id,
        size: item.size,
        quantity: item.quantity,
        price: item.productId.hasDiscount
          ? item.productId.discountedPrice
          : item.productId.originalPrice || item.productId.price,
      }));

      order = await Order.create({
        userId,
        orderId: `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`,
        products: orderProducts,
        totalAmount: finalAmount,
        couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
        couponCode: req.body.couponCode || undefined,
        paymentStatus: "Pending",
        paymentMethod: ["RazorPay"],
        shippingAddress,
        isTemporary: true,
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_ID_KEY,
      key_secret: process.env.RAZORPAY_SECRET_KEY,
    });

    const amountInPaise = Math.round(order.totalAmount * 100);
    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        orderType: "Product Purchase",
        customer_name: order.shippingAddress.fullName,
        customer_email: order.shippingAddress.email,
      },
    });

    await Order.findByIdAndUpdate(order._id, {
      razorpayOrderId: razorpayOrder.id,
    });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      yourOrderId: order._id,
      amount: amountInPaise,
      razorpayKeyId: process.env.RAZORPAY_ID_KEY,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const verifyRazorPay = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      order_id,
    } = req.body;

    console.log("Verifying Razorpay payment:", razorpay_payment_id);

    const secret = process.env.RAZORPAY_SECRET_KEY;
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      console.error(
        "Signature verification failed for payment:",
        razorpay_payment_id
      );

      await Order.findByIdAndUpdate(order_id, {
        paymentStatus: "Failed",
        orderStatus: "Cancelled",
      });

      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message:
          "Payment verification failed. Please try again or contact support.",
      });
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found. Please contact support.",
      });
    }

    order.paymentStatus = "completed";
    order.orderStatus = "Confirmed";
    order.razorpayPaymentId = razorpay_payment_id;
    order.isTemporary = false; // Remove temporary flag

    console.log(" Updating product inventory...");
    for (const item of order.products) {
      try {
        const product = await Product.findById(item.productId);
        if (!product) {
          console.warn("Product not found:", item.productId);
          continue;
        }

        product.saleCount = (Number(product.saleCount) || 0) + item.quantity;

        const sizeIndex = product.sizes.findIndex(
          (sizeObj) => sizeObj.size === item.size
        );
        if (sizeIndex !== -1) {
          product.sizes[sizeIndex].stock = Math.max(
            0,
            product.sizes[sizeIndex].stock - item.quantity
          );
        }

        await product.save();
      } catch (error) {
        console.error("Error updating product:", error);
      }
    }

    if (order.userId) {
      await Cart.findOneAndUpdate(
        { userId: order.userId },
        { $set: { product: [], totalPrice: 0 } }
      );
    }

    if (order.couponCode) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon) {
        coupon.count = (coupon.count || 0) + 1;
        await coupon.save();
      }
    }

    await order.save();

    console.log("Order successfully completed:", order._id);

    res.json({
      success: true,
      orderId: order._id,
      total: order.totalAmount,
      message:
        "Payment verified, order confirmed, stock updated, and coupon count updated.",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const handleFailedPayments = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      console.log("Failed payment request missing orderId");
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Order ID is required",
      });
    }

    console.log(`Processing failed payment for order: ${orderId}`);

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: "Failed",
        orderStatus: "Order Pending",
        isTemporary: false,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!order) {
      console.log(`Order not found for failed payment: ${orderId}`);
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      });
    }

    console.log(
      ` Order ${orderId} marked as Failed/Cancelled due to payment failure`
    );

    if (!order.userId) {
      console.log(`Guest checkout - no cart to preserve`);
      return res.json({
        success: true,
        message:
          "Payment failed. Please try again or select another payment method.",
      });
    }

 
    const cart = await Cart.findOne({ userId: order.userId });

    if (!cart || cart.product.length === 0) {
      console.log(
        `User ${order.userId} has no items in cart after failed payment`
      );
    } else {
      console.log(
        `User ${order.userId} has ${cart.product.length} items in cart preserved after failed payment`
      );
    }

    if (order.couponCode) {
      console.log(
        `Coupon ${order.couponCode} was not counted as used due to payment failure`
      );
    }

    return res.json({
      success: true,
      orderId: order._id,
      message:
        "Payment failed. Please try again or select another payment method.",
    });
  } catch (error) {
    console.error("Error handling failed payment:", error);

    let errorMessage = "Internal server error";

    if (error.name === "CastError") {
      errorMessage = "Invalid order ID format";
    } else if (error.name === "ValidationError") {
      errorMessage = "Validation error: " + error.message;
    } else if (error.code === 11000) {
      errorMessage = "Duplicate key error";
    }

    return res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const returnOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    console.log("Controller received orderId:", orderId);
    const { reason, customReason } = req.body;

    if (!orderId) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Order ID is required" });
    }

    let order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    let hasUpdatedProduct = false;

    order.products.forEach((product) => {
      if (product.status === "Return Requested") {
        console.log(
          `Skipping product ${product.productId}, already return requested.`
        );
        return;
      }

      product.status = "Return Requested";
      hasUpdatedProduct = true;
    });

    if (!hasUpdatedProduct) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({
          success: false,
          message: "All products are already return requested",
        });
    }

    order.orderStatus = "Return Requested";
    order.returnReason = customReason;

    await order.save();

    return res.status(statusCode.OK).json({
      success: true,
      message: "Return request for entire order submitted successfully",
    });
  } catch (error) {
    console.error("Error processing full order return request:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const returnRequest = async (req, res) => {
  const Id = req.params.id;
  const { customReason, reason } = req.body; // Added reason to destructuring

  console.log("Order ID:", Id);
  console.log("Return Reason:", reason);
  console.log("Custom Reason:", customReason);

  try {
    const order = await Order.findById(Id);
    if (!order) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    let hasUpdatedProduct = false;
    let skippedProducts = [];
    let updatedProducts = [];

    order.products.forEach((product) => {
      if (product.status === "Return Requested") {
        console.log(
          `Skipping product ${product.productId}, already return requested.`
        );
        skippedProducts.push(`Product already return requested`);
        return;
      }
      
      if (product.status === "Cancelled" || product.status === "Cancel Requested") {
        console.log(
          `Skipping product ${product.productId}, already cancelled.`
        );
        skippedProducts.push(`Product already cancelled`);
        return;
      }

      if (product.status === "Returned") {
        console.log(
          `Skipping product ${product.productId}, already returned.`
        );
        skippedProducts.push(`Product already returned`);
        return;
      }

      if (["Delivered", "Shipped", "Confirmed", "Pending"].includes(product.status)) {
        product.status = "Return Requested";
        hasUpdatedProduct = true;
        updatedProducts.push(product.productId);
        console.log(`Updated product ${product.productId} to Return Requested`);
      } else {
        skippedProducts.push(`Product in ${product.status} state cannot be returned`);
      }
    });

    if (!hasUpdatedProduct) {
      const allProductsStatus = order.products.map(p => p.status);
      return res
        .status(statusCode.BAD_REQUEST)
        .json({
          success: false,
          message: "No products are eligible for return. All products are either already returned, cancelled, or in non-returnable states.",
          productStatuses: allProductsStatus,
          skippedReasons: skippedProducts
        });
    }

    const allProductsInFinalState = order.products.every(product => 
      ["Return Requested", "Returned", "Cancelled", "Cancel Requested"].includes(product.status)
    );

    if (allProductsInFinalState) {
      order.orderStatus = "Return Requested";
    } else {
      order.orderStatus = "Partial Return Requested"; 
    }

    order.returnReason = reason || customReason;

    await order.save();

    return res
      .status(statusCode.OK)
      .json({
        success: true,
        message: `Return request submitted successfully for ${updatedProducts.length} product(s)`,
        updatedProducts: updatedProducts.length,
        skippedProducts: skippedProducts.length,
        details: {
          updated: updatedProducts,
          skipped: skippedProducts
        }
      });
      
  } catch (error) {
    console.error("Error in returnRequest:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const returnPartialRequest = async (req, res) => {
  const { orderId, productOrderId } = req.params;
  const { productId, reason, customReason } = req.body;

  try {
    console.log(
      `Processing return for Order ID: ${orderId}, Product ID: ${productId}, Product Order ID: ${productOrderId}`
    );

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Order not found" });
    }

    if (!order.products || order.products.length === 0) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "No products found in order" });
    }

    const product = order.products.id(productOrderId);
    if (!product) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Product not found in order" });
    }

    if (product.status === "Returned") {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Product already returned" });
    }

    product.status = "Return Requested";
    product.returnReason = reason;
    product.additionalDetails = customReason;

    await order.save();

    return res
      .status(statusCode.OK)
      .json({
        success: true,
        message: "Return request submitted successfully",
      });
  } catch (error) {
    console.error("Error processing return request:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Server error, please try again." });
  }
};

const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res
        .status(statusCode.UNAUTHORIZED)
        .json({ success: false, message: "User not authenticated" });
    }

    const user = await User.findById(userId).select("wallet");

    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    res.status(statusCode.OK).json({
      success: true,
      balance: user.wallet || 0,
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};
const payWithWallet = async (req, res) => {
  try {
    const userId = req.session.userId;
    const formData = req.body;

    if (!userId) {
      return res
        .status(statusCode.UNAUTHORIZED)
        .json({ success: false, message: "User not authenticated" });
    }

    const finalAmount = parseFloat(formData.finalAmount);

    const couponCode = formData.couponCode || "";
    const couponDiscount = parseFloat(formData.couponDiscount || 0);

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    if (user.wallet < finalAmount) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        insufficientBalance: true,
        message: "Insufficient wallet balance",
        walletBalance: user.wallet,
      });
    }

    const cart = await Cart.findOne({ userId }).populate("product.productId");
    if (!cart || !cart.product || cart.product.length === 0) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "No items in cart" });
    }

    const shippingAddress = {
      fullName: `${formData.firstName} ${formData.lastName}`,
      address:
        formData.streetAddress +
        (formData.landmark ? `, ${formData.landmark}` : ""),
      city: formData.city,
      state: formData.state,
      postalCode: formData.postCode,
      country: formData.country,
      phone: formData.phone,
    };

    const orderProducts = cart.product.map((item) => ({
      productId: item.productId._id,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
    }));

    const newOrder = new Order({
      orderId: generateOrderId(),
      userId: userId,
      products: orderProducts,
      orderStatus: "Confirmed",
      shippingAddress: shippingAddress,
      paymentMethod: ["wallet"],
      paymentStatus: "completed",
      totalAmount: finalAmount,
      couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
      couponCode: couponCode || undefined,
    });

    await newOrder.save();

    user.wallet -= finalAmount;

    user.walletHistory.push({
      date: new Date(),
      amount: -finalAmount,
    });

    await user.save();

    await Cart.findOneAndUpdate(
      { userId: userId },
      { $set: { product: [], totalPrice: 0 } }
    );

    res.status(statusCode.OK).json({
      success: true,
      message: "Order placed successfully using wallet",
      orderId: newOrder.orderId,
      remainingBalance: user.wallet.toFixed(2),
    });
  } catch (error) {
    console.error("Error processing wallet payment:", error);
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  checkoutPageInfo,
  cartCheckoutPage,
  applyCoupon,
  buyNow,
  cancelOrder,
  viewPurchaseDetails,
  cancelPartialProduct,
  orderCancel,
  razorpayCreation,
  verifyRazorPay,
  handleFailedPayments,
  returnOrder,
  returnRequest,
  returnPartialRequest,
  getWalletBalance,
  payWithWallet,
};
