const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const CategoryOffer = require("../../models/categoryOffer");
const ProductOffer = require("../../models/productOffer");
const Coupon = require("../../models/couponSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const statusCode = require("../../utils/statusCodes");

const checkoutPageInfo = async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.id;

  try {
    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");

    let products = [];
    let totalPrice = 0;
    console.log(productId, "these are the products for checkout page");

    if (productId) {
      // 🔹 SINGLE PRODUCT CHECKOUT
      const product = await Product.findById(productId).populate("category");
      if (!product) {
        return res.status(404).render("checkout", {
          error: "Product not found",
          products: [],
          user: {
            email: user.email,
            username: user.username,
            contact: user.contact,
            address: user.address?.[0] || null,
          },
        });
      }

      const productOffer = await ProductOffer.findOne({ productId });
      const categoryOffer = await CategoryOffer.findOne({
        categoryId: product.category._id,
      });

      let finalPrice = Number(product.price) || 0;
      let appliedOffer = null;

      if (productOffer) {
        finalPrice =
          productOffer.discountType === "percentage"
            ? finalPrice - (finalPrice * productOffer.discountValue) / 100
            : finalPrice - productOffer.discountValue;
        appliedOffer = productOffer;
      } else if (categoryOffer) {
        finalPrice =
          categoryOffer.discountType === "percentage"
            ? finalPrice - (finalPrice * categoryOffer.discountValue) / 100
            : finalPrice - categoryOffer.discountValue;
        appliedOffer = categoryOffer;
      }

      const cart = await Cart.findOne({ userId });
      const cartItem = cart
        ? cart.product.find((item) => item.productId.toString() === productId)
        : null;

      const quantity = cartItem ? cartItem.quantity : 1;
      const size = cartItem ? cartItem.size : "M";

      const totalItemPrice = Number(finalPrice) * Number(quantity);
      totalPrice = totalItemPrice;

      products = [
        {
          productId: product._id,
          title: product.title,
          originalPrice: Number(product.price).toFixed(2),
          discountedPrice: Number(finalPrice).toFixed(2),
          hasDiscount: appliedOffer !== null,
          appliedOffer,
          price: Number(finalPrice),
          quantity,
          size,
          totalPrice: Number(totalItemPrice),
          image: product.image?.[0] || "default-product.jpg",
        },
      ];
    } else {
      // 🔹 FULL CART CHECKOUT
      const cart = await Cart.findOne({ userId }).populate(
        "product.productId",
        "title price image category hasDiscount discountedPrice"
      );

      if (!cart || !cart.product || cart.product.length === 0) {
        return res.status(400).render("checkout", {
          error: "Your cart is empty",
          products: [],
          user: {
            email: user.email,
            username: user.username,
            contact: user.contact,
            address: user.address?.[0] || null,
          },
        });
      }

      products = await Promise.all(
        cart.product.map(async (item) => {
          const product = item.productId;
          let finalPrice = Number(product.hasDiscount ? product.discountedPrice : product.price) || 0;
          let appliedOffer = null;

          const productOffer = await ProductOffer.findOne({ productId: product._id });
          const categoryOffer = await CategoryOffer.findOne({ categoryId: product.category });

          if (productOffer) {
            finalPrice =
              productOffer.discountType === "percentage"
                ? finalPrice - (finalPrice * productOffer.discountValue) / 100
                : finalPrice - productOffer.discountValue;
            appliedOffer = productOffer;
          } else if (categoryOffer) {
            finalPrice =
              categoryOffer.discountType === "percentage"
                ? finalPrice - (finalPrice * categoryOffer.discountValue) / 100
                : finalPrice - categoryOffer.discountValue;
            appliedOffer = categoryOffer;
          }

          const totalItemPrice = Number(finalPrice) * Number(item.quantity);
          totalPrice += totalItemPrice;

          return {
            productId: product._id,
            title: product.title,
            originalPrice: Number(product.price).toFixed(2),
            discountedPrice: Number(finalPrice).toFixed(2),
            hasDiscount: appliedOffer !== null || product.hasDiscount,
            appliedOffer,
            quantity: item.quantity,
            size: item.size,
            totalPrice: Number(totalItemPrice),
            image: product.image?.[0] || "default-product.jpg",
          };
        })
      );
    }

    // 🔹 VALID COUPONS
    const allCoupons = await Coupon.find({
      minPurchase: { $lte: totalPrice },
      expireDate: { $gte: new Date() },
    });

    const userCoupons = await User.findById(userId).populate("usedCoupons.couponId");
    const usedCouponCodes = userCoupons.usedCoupons.map((c) => c.code);
    const applicableCoupons = allCoupons.filter(
      (coupon) => !usedCouponCodes.includes(coupon.code)
    );

    res.render("checkout", {
      products,
      totalPrice: totalPrice.toFixed(2),
      applicableCoupons,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop" },
        { name: "Cart", url: "/cart" },
        { name: "Checkout" },
      ],
      user: {
        email: user.email,
        username: user.username,
        contact: user.contact,
        address: user.address || [],
      },
      paymentError: req.query.error === "payment",
      errorMessage:
        req.query.error === "payment"
          ? "Your payment was not successful. Please try again or select another payment method."
          : "",
    });
  } catch (error) {
    console.error("Error fetching checkout data:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const cartCheckoutPage = async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await User.findById(userId);
    if (!user) return res.redirect("/login");
    

    const cart = await Cart.findOne({ userId }).populate({
      path: "product.productId",
      select: "title price image category hasDiscount originalPrice discountedPrice",
      populate: { path: "category", select: "_id" },
    });
    
    if (!cart || !cart.product || cart.product.length === 0) {
      return res.status(400).render("checkout", {
        error: "Your cart is empty",
        products: [],
        totalPrice: 0,
        user: {
          email: user.email,
          username: user.username,
          breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop" },
        { name: "Cart", url: "/cart" },
        { name: "Checkout" },
      ],
          contact: user.contact,
          address: user.address || [],
        },
      });
    }

    let totalPrice = 0;

    const products = await Promise.all(
      cart.product.map(async (item) => {
        const product = item.productId;
        const originalPrice = Number(product.originalPrice || product.price || 0);

        const productOfferDoc = await ProductOffer.findOne({ productId: product._id });
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
              ? originalPrice - (originalPrice * productOfferDoc.discountValue) / 100
              : originalPrice - productOfferDoc.discountValue;
          appliedOffer = productOfferDoc;
        } else if (categoryOfferDoc) {
          finalPrice =
            categoryOfferDoc.discountType === "percentage"
              ? originalPrice - (originalPrice * categoryOfferDoc.discountValue) / 100
              : originalPrice - categoryOfferDoc.discountValue;
          appliedOffer = categoryOfferDoc;
        } else if (product.hasDiscount) {
          finalPrice = Number(product.discountedPrice);
        }

        const totalItemPrice = Number(finalPrice) * Number(item.quantity);
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
          totalPrice: Number(totalItemPrice),
          image: product.image?.[0] || "default-product.jpg",
        };
      })
    );

    const allCoupons = await Coupon.find({
      minPurchase: { $lte: totalPrice },
      expireDate: { $gte: new Date() },
    });

    const userCoupons = await User.findById(userId).populate("usedCoupons.couponId");
    const usedCouponCodes = userCoupons.usedCoupons.map((c) => c.code);
    const applicableCoupons = allCoupons.filter(
      (coupon) => !usedCouponCodes.includes(coupon.code)
    );

    res.render("checkout", {
      products,
      totalPrice: totalPrice.toFixed(2),
      applicableCoupons,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Shop", url: "/shop" },
        { name: "Cart", url: "/cart" },
        { name: "Checkout" },
      ],
      user: {
        email: user.email,
        username: user.username,
        contact: user.contact,
        address: user.address || [],
      },
      paymentError: req.query.error === "payment",
      errorMessage:
        req.query.error === "payment"
          ? "Your payment was not successful. Please try again or select another payment method."
          : "",
    });
  } catch (error) {
    console.error("Error fetching cart checkout data:", error);
    res
      .status(500)
      .render("error", {
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
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
  }
};

const generateOrderId = () => {
  const randomNum = Math.floor(Math.random() * 100000); 
  return `ORD${randomNum.toString().padStart(6, "0")}`;
};

const buyNow = async (req, res) => {
  try {
    const userId = req.session.userId;
    const formData = req.body;

    if (!formData.products || formData.products.length === 0) {
      return res.status(400).json({ success: false, message: "No products provided" });
    }

    const userCart = await Cart.findOne({ userId }).populate("product.productId");
    if (!userCart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const formProducts = formData.products.map(p => ({
      productId: p.productId.toString(),
      size: p.size,
      quantity: parseInt(p.quantity)
    }));

    let purchasedItems = [];
    let totalAmount = 0; 

    for (const formItem of formProducts) {
      const cartItem = userCart.product.find(
        item =>
          item.productId._id.toString() === formItem.productId &&
          item.size === formItem.size
      );

      if (!cartItem) {
        return res.status(400).json({
          success: false,
          message: `Product not found in cart for productId: ${formItem.productId}`
        });
      }

      const product = await Product.findById(formItem.productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found in database: ${formItem.productId}`
        });
      }

      const sizeInfo = product.sizes.find(s => s.size === formItem.size);
      if (!sizeInfo || sizeInfo.stock < formItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.title} (Size: ${formItem.size})`
        });
      }

      await Product.updateOne(
        { _id: formItem.productId, "sizes.size": formItem.size },
        {
          $inc: {
            "sizes.$.stock": -formItem.quantity,
            totalStock: -formItem.quantity,
            saleCount: formItem.quantity
          }
        }
      );

      const itemTotal = cartItem.price * formItem.quantity;
      totalAmount += itemTotal;

      purchasedItems.push({
        productId: formItem.productId,
        size: formItem.size,
        quantity: formItem.quantity,
        price: cartItem.price,
        total: itemTotal
      });
    }

    userCart.product = userCart.product.filter(
      item =>
        !formProducts.some(
          fp =>
            fp.productId === item.productId._id.toString() &&
            fp.size === item.size
        )
    );
    await userCart.save();

    const shippingAddress = {
      fullName: `${formData.firstName} ${formData.lastName}`,
      address:
        formData.streetAddress +
        (formData.landmark ? `, ${formData.landmark}` : ""),
      city: formData.city,
      state: formData.state,
      postalCode: formData.postCode,
      country: formData.country,
      phone: formData.phone
    };

    let paymentMethod = formData.paymentMethod?.toLowerCase().trim();
    if (paymentMethod.includes("cash on delivery") || paymentMethod.includes("cod")) {
      paymentMethod = "cod";
    } else if (paymentMethod.includes("razorpay")) {
      paymentMethod = "razorpay";
    } else if (paymentMethod.includes("wallet")) {
      paymentMethod = "wallet";
    } else {
      paymentMethod = "cod";
    }

    const newOrder = new Order({
      orderId: generateOrderId(),
      userId,
      products: purchasedItems,
      orderStatus: "Confirmed",
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === "wallet" ? "completed" : "Pending",
      totalAmount,
      couponCode: formData.couponCode || "",
      couponDiscount: formData.couponDiscount || 0
    });

    await newOrder.save();

    res.status(200).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder.orderId,
      totalAmount: totalAmount.toFixed(2)
    });
  } catch (error) {
    console.error("Error in buyNow controller:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
const razorpayCreation = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { orderId, isRetry, ...formData } = req.body;

    if (isRetry && orderId) {
      const existingOrder = await Order.findById(orderId)
        .populate('userId')
        .populate('products.productId');

      if (!existingOrder) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      if (existingOrder.orderStatus !== 'Order Pending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Order is not eligible for retry payment' 
        });
      }

      if (existingOrder.userId._id.toString() !== userId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Unauthorized access to order' 
        });
      }

      // Check stock availability for all products before proceeding
      for (const item of existingOrder.products) {
        const product = await Product.findById(item.productId._id);
        if (!product) {
          return res.status(404).json({ 
            success: false, 
            message: `Product ${item.productId.title} not found` 
          });
        }

        const sizeInfo = product.sizes.find(s => s.size === item.size);
        if (!sizeInfo || sizeInfo.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.title} (Size: ${item.size}). Available: ${sizeInfo?.stock || 0}`,
          });
        }
      }

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_ID_KEY,
        key_secret: process.env.RAZORPAY_SECRET_KEY,
      });

      const amountInPaise = Math.round(existingOrder.totalAmount * 100);

      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: "INR",
        receipt: `retry_${existingOrder._id}_${Date.now()}`,
        notes: {
          orderType: "Retry Payment",
          originalOrderId: existingOrder._id.toString(),
          customer_name: existingOrder.shippingAddress.fullName,
          customer_email: existingOrder.shippingAddress.email,
        },
      });

      existingOrder.razorpayOrderId = razorpayOrder.id;
      existingOrder.paymentStatus = "Pending";
      await existingOrder.save();

      return res.json({
        success: true,
        orderId: razorpayOrder.id,
        yourOrderId: existingOrder._id,
        amount: amountInPaise,
        razorpayKeyId: process.env.RAZORPAY_ID_KEY,
        prefill: {
          name: existingOrder.shippingAddress.fullName,
          email: existingOrder.shippingAddress.email,
          contact: existingOrder.shippingAddress.phone,
        }
      });
    }

    if (!formData.products || formData.products.length === 0) {
      return res.status(400).json({ success: false, message: "No products provided" });
    }

    const userCart = await Cart.findOne({ userId }).populate("product.productId");
    if (!userCart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    let purchasedItems = [];
    let subtotal = 0;

    for (const formItem of formData.products) {
      const cartItem = userCart.product.find(
        item =>
          item.productId._id.toString() === formItem.productId &&
          item.size === formItem.size
      );

      if (!cartItem) {
        return res.status(400).json({
          success: false,
          message: `Product not found in cart: ${formItem.productId}`,
        });
      }

      const product = await Product.findById(formItem.productId).populate("category");
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found in DB" });
      }

      const sizeInfo = product.sizes.find(s => s.size === formItem.size);
      if (!sizeInfo || sizeInfo.stock < parseInt(formItem.quantity)) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.title} (Size: ${formItem.size})`,
        });
      }

      const productOffer = await ProductOffer.findOne({
        productId: product._id,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
      });

      let categoryOffer = null;
      if (product.category && product.category._id) {
        categoryOffer = await CategoryOffer.findOne({
          categoryId: product.category._id,
          startDate: { $lte: new Date() },
          endDate: { $gte: new Date() },
        });
      }

      let price = Number(product.price || product.originalPrice || 0);

      if (productOffer) {
        price =
          productOffer.discountType === "percentage"
            ? price - (price * productOffer.discountValue) / 100
            : price - productOffer.discountValue;
      } else if (categoryOffer) {
        price =
          categoryOffer.discountType === "percentage"
            ? price - (price * categoryOffer.discountValue) / 100
            : price - categoryOffer.discountValue;
      } else if (product.hasDiscount) {
        price = Number(product.discountedPrice);
      }

      subtotal += price * parseInt(formItem.quantity);

      purchasedItems.push({
        productId: product._id,
        size: formItem.size,
        quantity: parseInt(formItem.quantity),
        price,
        total: price * parseInt(formItem.quantity),
      });
    }

    const couponDiscount = parseFloat(formData.couponDiscount || 0);
    const finalAmount = Math.max(0, subtotal - couponDiscount);

    const shippingAddress = {
      fullName: `${formData.firstName} ${formData.lastName}`,
      address: formData.streetAddress + (formData.landmark ? `, ${formData.landmark}` : ""),
      city: formData.city,
      state: formData.state,
      postalCode: formData.postCode,
      country: formData.country,
      phone: formData.phone,
      email: formData.email,
    };

    const order = await Order.create({
      orderId: generateOrderId(),
      userId,
      products: purchasedItems,
      totalAmount: finalAmount,
      couponCode: formData.couponCode || "",
      couponDiscount,
      paymentStatus: "Pending",
      paymentMethod: ["RazorPay"],
      orderStatus: "Pending",
      shippingAddress,
      isTemporary: true,
    });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_ID_KEY,
      key_secret: process.env.RAZORPAY_SECRET_KEY,
    });

    const amountInPaise = Math.round(finalAmount * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order._id.toString(),
      notes: {
        orderType: "Product Purchase",
        customer_name: shippingAddress.fullName,
        customer_email: shippingAddress.email,
      },
    });

    await Order.findByIdAndUpdate(order._id, { razorpayOrderId: razorpayOrder.id });

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      yourOrderId: order._id,
      amount: amountInPaise,
      razorpayKeyId: process.env.RAZORPAY_ID_KEY,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const verifyRazorPay = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id, isRetry } = req.body;

    const secret = process.env.RAZORPAY_SECRET_KEY;
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      await Order.findByIdAndUpdate(order_id, {
        paymentStatus: "Failed",
        orderStatus: isRetry ? "Order Pending" : "Cancelled",
      });
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Try again.",
      });
    }

    const order = await Order.findById(order_id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Check if this is a retry payment
    const wasRetry = isRetry || order.orderStatus === "Order Pending";

    order.paymentStatus = "completed";
    order.orderStatus = "Confirmed";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.isTemporary = false;

    for (const item of order.products) {
      await Product.updateOne(
        { _id: item.productId, "sizes.size": item.size },
        {
          $inc: {
            "sizes.$.stock": -item.quantity,
            saleCount: item.quantity,
          },
        }
      );
    }

    if (!wasRetry) {
      const userCart = await Cart.findOne({ userId: order.userId });
      if (userCart) {
        userCart.product = userCart.product.filter(
          cartItem =>
            !order.products.some(
              purchased =>
                purchased.productId.toString() === cartItem.productId.toString() &&
                purchased.size === cartItem.size
            )
        );
        await userCart.save();
      }
    }

    if (order.couponCode && !wasRetry) {
      const coupon = await Coupon.findOne({ code: order.couponCode });
      if (coupon) {
        coupon.count = (coupon.count || 0) + 1;
        await coupon.save();
      }
    }

    await order.save();

    res.json({
      success: true,
      orderId: order._id,
      total: order.totalAmount,
      message: wasRetry 
        ? "Retry payment successful! Order confirmed." 
        : "Payment verified and order confirmed.",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
    const { productId, reason, customReason, quantity } = req.body;

    console.log(req.body, "Received from cancel product");

    if (!orderId || !productId || !quantity) {
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

    const product = order.products.find(
      (p) => p.productId.toString() === productId
    );
    if (!product) {
      return res
        .status(statusCode.NOT_FOUND)
        .json({ success: false, message: "Product not found in order." });
    }

    if (["Cancel Requested", "Cancelled"].includes(product.status)) {
      return res
        .status(statusCode.BAD_REQUEST)
        .json({ success: false, message: "Product already cancelled." });
    }

    if (quantity > product.quantity) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Invalid quantity. You can't cancel more than ordered quantity (${product.quantity}).`,
      });
    }

    product.status = "Cancelled";
    product.cancelledQuantity = quantity;
    product.cancelReason = reason || "Not specified";
    product.cancelDetails = customReason || "";
    product.cancelRequestDate = new Date();
    order.markModified("products");

    // Refund calculation
    const refundAmount = (product.price || 0) * quantity;

    // Update stock back to product inventory
    const productData = await Product.findById(productId);
    if (productData && Array.isArray(productData.sizes)) {
      const sizeObj = productData.sizes.find((s) => s.size === product.size);
      if (sizeObj) {
        sizeObj.stock += quantity;
      }
      await productData.save();
    }

    const user = await User.findById(order.userId);
    if (user) {
      user.wallet = (user.wallet || 0) + refundAmount;

      user.walletHistory.push({
        date: new Date(),
        amount: refundAmount,
        description: `Refund of ₹${refundAmount} for cancelled product ${productId} (x${quantity}) from order ${order.orderId}`,
        type: "credit",
      });

      await user.save();
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
      message: `Refund of ₹${refundAmount} has been credited to your wallet.`,
      refundAmount,
    });
  } catch (error) {
    console.error("Error in cancelPartialProduct:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error." });
  }
};




const orderCancel = async (req, res) => {
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
    }

    for (const item of order.products) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.saleCount = Math.max(0, (product.saleCount || 0) - item.quantity);

        // Ensure sizes array exists
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

    order.cancellationReason = reason || "No reason provided";
    if (additionalDetails) {
      order.cancelDetails = additionalDetails;
    }

    order.orderStatus = "Cancelled";
    order.markModified("products");

    let refundedAmount = 0;

    if (
      order.paymentStatus === "completed" &&
      !order.paymentMethod.includes("cod")
    ) {
      refundedAmount = order.totalAmount;

      user.wallet += refundedAmount;
      user.walletHistory.push({
        amount: refundedAmount,
        type: "credit",
        description: `Refund for cancelled order ${order._id}`,
      });

      await user.save();

      order.paymentStatus = "Refunded";
    }

    await order.save();

    return res.status(statusCode.OK).json({
      success: true,
      message: "Order cancelled successfully",
      refunded: refundedAmount,
    });
  } catch (error) {
    console.error("Error in cancelOrder:", error);
    return res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: "Internal server error",
      });
  }
};

//   console.log('Environment variables check:');
// console.log('RAZOPAY_ID_KEY:', process.env.RAZORPAY_ID_KEY);
// console.log('RAZOPAY_SECRET_KEY:', process.env.RAZORPAY_SECRET_KEY);



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
      return res.status(statusCode.BAD_REQUEST).json({
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

      if (
        product.status === "Cancelled" ||
        product.status === "Cancel Requested"
      ) {
        console.log(
          `Skipping product ${product.productId}, already cancelled.`
        );
        skippedProducts.push(`Product already cancelled`);
        return;
      }

      if (product.status === "Returned") {
        console.log(`Skipping product ${product.productId}, already returned.`);
        skippedProducts.push(`Product already returned`);
        return;
      }

      if (
        ["Delivered", "Shipped", "Confirmed", "Pending"].includes(
          product.status
        )
      ) {
        product.status = "Return Requested";
        hasUpdatedProduct = true;
        updatedProducts.push(product.productId);
        console.log(`Updated product ${product.productId} to Return Requested`);
      } else {
        skippedProducts.push(
          `Product in ${product.status} state cannot be returned`
        );
      }
    });

    if (!hasUpdatedProduct) {
      const allProductsStatus = order.products.map((p) => p.status);
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message:
          "No products are eligible for return. All products are either already returned, cancelled, or in non-returnable states.",
        productStatuses: allProductsStatus,
        skippedReasons: skippedProducts,
      });
    }

    const allProductsInFinalState = order.products.every((product) =>
      [
        "Return Requested",
        "Returned",
        "Cancelled",
        "Cancel Requested",
      ].includes(product.status)
    );

    if (allProductsInFinalState) {
      order.orderStatus = "Return Requested";
    } else {
      order.orderStatus = "Partial Return Requested";
    }

    order.returnReason = reason || customReason;

    await order.save();

    return res.status(statusCode.OK).json({
      success: true,
      message: `Return request submitted successfully for ${updatedProducts.length} product(s)`,
      updatedProducts: updatedProducts.length,
      skippedProducts: skippedProducts.length,
      details: {
        updated: updatedProducts,
        skipped: skippedProducts,
      },
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

    return res.status(statusCode.OK).json({
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
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
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
    res
      .status(statusCode.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Internal server error" });
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
