const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const CategoryOffer = require('../../models/categoryOffer');
const ProductOffer = require('../../models/productOffer');
const Coupon = require('../../models/couponSchema')
const Razorpay=require('razorpay');
const crypto=require('crypto');



const checkoutPageInfo = async (req, res) => {
    const userId = req.session.userId;
    const productId = req.params.id; 
    
    try {
        const user = await User.findById(userId);
        
        let products = [];
        let totalPrice = 0;

        if (productId) {
            const product = await Product.findById(productId).populate('category');
            if (!product) {
                return res.status(404).render('checkout', { 
                    error: 'Product not found',
                    products: [],
                    user: {
                        email: user.email,
                        username: user.username,
                        contact: user.contact,
                        address: user.address?.length > 0 ? user.address[0] : null
                    }
                });
            }

            const productOffer = await ProductOffer.findOne({ productId });
            const categoryOffer = await CategoryOffer.findOne({ categoryId: product.category._id });

            let finalPrice = product.price;
            let appliedOffer = null;

            if (productOffer) {
                finalPrice = productOffer.discountType === 'percentage' 
                    ? product.price - (product.price * productOffer.discountValue / 100)
                    : product.price - productOffer.discountValue;
                appliedOffer = productOffer;
            } 
            else if (categoryOffer) {
                finalPrice = categoryOffer.discountType === 'percentage' 
                    ? product.price - (product.price * categoryOffer.discountValue / 100)
                    : product.price - categoryOffer.discountValue;
                appliedOffer = categoryOffer;
            }

            const cart = await Cart.findOne({ userId });
            const cartItem = cart ? cart.product.find(item => item.productId.toString() === productId) : null;

            products = [{
                productId: product._id,
                title: product.title,
                originalPrice: product.price,
                discountedPrice: finalPrice,
                hasDiscount: appliedOffer !== null,
                appliedOffer,
                price: finalPrice,  
                quantity: cartItem ? cartItem.quantity : 1, 
                size: cartItem ? cartItem.size : 'M', 
                totalPrice: finalPrice * (cartItem ? cartItem.quantity : 1),
                image: product.image?.length > 0 ? product.image[0] : 'default-product.jpg'
            }];
            totalPrice = finalPrice * (cartItem ? cartItem.quantity : 1);
        } else {
            const cart = await Cart.findOne({ userId })
                .populate('product.productId', 'title price image category hasDiscount discountedPrice');

            if (!cart || !cart.product || cart.product.length === 0) {
                return res.status(400).render('checkout', { 
                    error: 'Your cart is empty',
                    products: [],
                    user: {
                        email: user.email,
                        username: user.username,
                        contact: user.contact,
                        address: user.address?.length > 0 ? user.address[0] : null
                    }
                });
            }

            products = await Promise.all(cart.product.map(async (item) => {
                const product = item.productId;
                let finalPrice = product.hasDiscount ? product.discountedPrice : product.price;
                let appliedOffer = null;

                const categoryOffer = await categoryOffer.findOne({ categoryId: product.category });

                const productOffer = await productOffer.findOne({ productId: product._id });

                if (productOffer) {
                    finalPrice = productOffer.discountType === 'percentage' 
                        ? product.price - (product.price * productOffer.discountValue / 100)
                        : product.price - productOffer.discountValue;
                    appliedOffer = productOffer;
                } 
                else if (categoryOffer) {
                    finalPrice = categoryOffer.discountType === 'percentage' 
                        ? product.price - (product.price * categoryOffer.discountValue / 100)
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
                    image: product.image?.length > 0 ? product.image[0] : 'default-product.jpg'
                };
            }));

            totalPrice = products.reduce((sum, product) => sum + product.totalPrice, 0);
        }

        const applicableCoupons = await Coupon.find({ 
            minPurchase: { $lte: totalPrice }, 
            expireDate: { $gte: new Date() }  // Ensures the coupon is not expired
        });
        
        
        const defaultAddress = user.address?.length > 0 ? user.address[0] : null;

        res.render('checkout', { 
            products,
            totalPrice,
            applicableCoupons,
            user: {
                email: user.email,
                username: user.username,
                contact: user.contact,
                address: defaultAddress
            }
        });
        
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        return res.status(500).json({success:false,message:'internal server error'})
    }
};


const cartCheckoutPage = async (req, res,next) => {
    const userId = req.session.userId;
    
    try {
        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        if (!user) {
            return res.redirect("/login");
        }

        const cart = await Cart.findOne({ userId })
            .populate({
                path: 'product.productId',
                select: 'title price image category hasDiscount originalPrice discountedPrice',
                populate: {
                    path: 'category',
                    select: '_id'
                }
            });

        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).render("checkout", {
                error: "Your cart is empty",
                products: [],
                totalPrice: 0,
                user: {
                    email: user.email,
                    username: user.username,
                    contact: user.contact,
                    address: user.address?.length > 0 ? user.address[0] : null
                }
            });
        }

        let totalPrice = 0;
        const products = await Promise.all(cart.product.map(async (item) => {
            const product = item.productId;
            const originalPrice = product.originalPrice || product.price || 0;
            
            const productOffer = await ProductOffer.findOne({ productId: product._id });
            const categoryOffer = await CategoryOffer.findOne({ categoryId: product.category._id })   

            let finalPrice = originalPrice;
            let appliedOffer = null;

            if (productOffer) {
                finalPrice = productOffer.discountType === "percentage"
                    ? originalPrice - (originalPrice * productOffer.discountValue / 100)
                    : originalPrice - productOffer.discountValue;
                appliedOffer = productOffer;
            } 
            else if (categoryOffer) {
                finalPrice = categoryOffer.discountType === "percentage"
                    ? originalPrice - (originalPrice * categoryOffer.discountValue / 100)
                    : originalPrice - categoryOffer.discountValue;
                appliedOffer = categoryOffer;
            } 
            else if (product.hasDiscount) {
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
                image: product.image?.[0] || "default-product.jpg"
            };
        }));

        const defaultAddress = user.address?.length > 0 ? user.address[0] : null;
        const applicableCoupons = await Coupon.find({ 
            minPurchase: { $lte: totalPrice }, 
            expireDate: { $gte: new Date() }  // Ensures the coupon is not expired
        });
        
        res.render("checkout", {
            products,
            totalPrice: totalPrice.toFixed(2),
            applicableCoupons,
            user: {
                email: user.email,
                username: user.username,
                contact: user.contact,
                address: defaultAddress
            },
            user,
            error: null
        });

    } catch (error) {
        console.error("Error fetching cart checkout data:", error);
        // In your error handler
res.status(500).render('user/error', { 
    error: err.message,
    user: req.session.userId ? { username: 'User' } : null // Provide minimal user data for header
});
    }
};



const generateOrderId = () => {
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${randomNum}`;
};

const buyNow = async (req, res) => {
    try {
        const userId = req.session.userId;
        const formData = req.body;
        
        // Get coupon information from the request body
        const couponCode = formData.couponCode || '';
        const couponDiscount = parseFloat(formData.couponDiscount || 0);

        const cart = await Cart.findOne({ userId }).populate('product.productId');

        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).json({ success: false, message: 'No items in cart' });
        }

        // Calculate the original subtotal
        const subtotal = cart.product.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Apply the discount to get final amount
        const finalAmount = Math.max(0, subtotal - couponDiscount);

        const shippingAddress = {
            fullName: `${formData.firstName} ${formData.lastName}`,
            address: formData.streetAddress + (formData.landmark ? `, ${formData.landmark}` : ''),
            city: formData.city,
            state: formData.state,
            postalCode: formData.postCode,
            country: formData.country,
            phone: formData.phone
        };

        const orderProducts = cart.product.map(item => ({
            productId: item.productId._id,
            size: item.size,
            quantity: item.quantity,
            price: item.price
        }));

        const newOrder = new Order({
            orderId: generateOrderId(),
            userId: userId,
            products: orderProducts,
            orderStatus: 'Confirmed',
            shippingAddress: shippingAddress,
            paymentMethod: formData.paymentMethod,
            paymentStatus: 'Pending',
            totalAmount: finalAmount, // Use totalAmount as required by schema
            couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
            couponCode: couponCode || undefined
        });

        await newOrder.save();

        // Empty cart after order placement
        await Cart.findOneAndUpdate({ userId: userId }, { $set: { product: [], totalPrice: 0 } });

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder.orderId,
            finalAmount: finalAmount.toFixed(2)
        });

    } catch (error) {
        console.error('Error in buyNow controller:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.userId;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        for (const item of order.products) {
            const product = await Product.findById(item.productId);

            if (product) {
                product.saleCount-=1;
                if (!Array.isArray(product.sizes)) {
                    console.warn(`Product ${product._id} has no sizes array`);
                    continue;
                }

                const sizeIndex = product.sizes.findIndex(sizeObj => sizeObj.size === item.size);

                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].stock += item.quantity;
                } else {
                    product.sizes.push({
                        size: item.size,
                        stock: item.quantity,
                        canceled: true
                    });
                }

                await product.save();
            }
        }
        
        if (order.paymentStatus === 'completed' && order.userId) {
            const user = await User.findById(order.userId);
            if (user) {
                user.wallet += order.totalAmount; 
                user.walletBalance += order.totalAmount;
                user.walletHistory.push({
                    date: new Date(),
                    amount: order.totalAmount
                    
                });

                await user.save();
            }
        }

        order.orderStatus = 'Cancelled';
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            refunded: order.paymentStatus === 'completed' ? order.totalAmount : 0
        });

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        return res.status(500).json({success:false,message:'internal server error'})
    }
};


const viewPurchaseDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.userId;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'products.productId',
                select: 'name price image' 
            })
            .populate('userId', 'username email contact');

        if (!order) {
            return res.status(404).render('error', {
                message: 'Order not found'
            });
        }
        
        if (order.userId._id.toString() !== userId) {
            return res.status(403).render('error', {
                message: 'Unauthorized access to order'
            });
        }
        
        res.render('purchaseDetails', {  
            order: order,
            user: order.userId
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        return res.status(500).json({success:false,message:'internal server error'})

    }
};


//   console.log('Environment variables check:');
// console.log('RAZOPAY_ID_KEY:', process.env.RAZORPAY_ID_KEY);
// console.log('RAZOPAY_SECRET_KEY:', process.env.RAZORPAY_SECRET_KEY);

const razorpayCreation = async (req, res) => {
    try {
        const formData = req.body;
        let subtotal = parseFloat(formData.totalAmount || 0);
        const couponDiscount = parseFloat(formData.couponDiscount || 0); // ✅ Get discount
        const finalAmount = Math.max(0, subtotal - couponDiscount); // ✅ Apply discount
        
        const userId = req.session.userId || null;

        // Get cart data with populated product information
        let cart = null;
        if (userId) {
            cart = await Cart.findOne({ userId }).populate("product.productId");
        }

        // If subtotal is missing, calculate from cart
        if (!subtotal && cart && cart.product.length > 0) {
            subtotal = cart.product.reduce((total, item) => {
                const price = item.productId.hasDiscount ? 
                    item.productId.discountedPrice : 
                    item.productId.originalPrice || item.productId.price;
                return total + (price * item.quantity);
            }, 0);
        }

        if (!subtotal) {
            return res.status(400).json({ 
                success: false, 
                message: "Unable to determine order amount. Please try again." 
            });
        }

        // ✅ Use `finalAmount` instead of `subtotal`
        const amountInPaise = Math.round(finalAmount * 100); // Razorpay needs paise

        // Generate a unique order ID
        const orderId = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Get user details
        let user = null;
        if (userId) {
            user = await User.findById(userId);
        }

        // Prepare shipping address
        const shippingAddress = {
            fullName: user ? user.username : `${formData.firstName || ""} ${formData.lastName || ""}`.trim(),
            email: user ? user.email : formData.email || "",
            phone: user ? user.contact || formData.phone || "" : formData.phone || "",
            address: (user?.address?.length > 0 && user.address[0]?.address) ? 
            user.address[0].address : formData.streetAddress || "",
            city: formData.city || (user?.address?.length > 0 ? user.address[0].city || "" : ""),
            state: formData.state || (user?.address?.length > 0 ? user.address[0].state || "" : ""),
            postalCode: formData.postCode || (user?.address?.length > 0 ? user.address[0].postCode || "" : ""),
            country: formData.country || (user?.address?.length > 0 ? user.address[0].country || "" : "")
        };

        // Prepare order products
        let orderProducts = [];
        if (cart && cart.product.length > 0) {
            orderProducts = cart.product.map(item => {
                const price = item.productId.hasDiscount ? 
                    item.productId.discountedPrice : 
                    item.productId.originalPrice || item.productId.price;
                return {
                    productId: item.productId._id,
                    size: item.size,
                    quantity: item.quantity,
                    price: price
                };
            });
        }

        // ✅ Save `finalAmount` in the database
        const order = await Order.create({
            orderId: orderId,
            userId: userId,
            guestEmail: userId ? undefined : formData.email || "anonymous",
            isGuestCheckout: !userId,
            products: orderProducts,  
            totalAmount: finalAmount, // ✅ Fix: Save discounted amount
            couponDiscount: couponDiscount > 0 ? couponDiscount : undefined, // ✅ Store discount
            couponCode: formData.couponCode || undefined, // ✅ Store coupon code
            paymentStatus: "Pending",
            paymentMethod: ["RazorPay"],
            shippingAddress
        });

        // ✅ Create Razorpay order with `finalAmount`
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_ID_KEY,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });

        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise, // ✅ Fix: Use finalAmount instead of subtotal
            currency: "INR",
            receipt: order._id.toString(),
            notes: {
                orderType: "Product Purchase",
                customer_name: shippingAddress.fullName,
                customer_email: shippingAddress.email
            }
        });

        // Save Razorpay order ID in database
        await Order.findByIdAndUpdate(order._id, { razorpayOrderId: razorpayOrder.id });

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            yourOrderId: order._id,
            amount: amountInPaise,
            razorpayKeyId: process.env.RAZORPAY_ID_KEY
        });

    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        return res.status(500).json({success:false,message:'Internal server error'});
    }
};


const verifyRazorPay = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, order_id } = req.body;
        console.log("Verifying Razorpay payment:", razorpay_payment_id);

        // Step 1: Verify the Payment Signature
        const secret = process.env.RAZORPAY_SECRET_KEY;
        const generated_signature = crypto
            .createHmac("sha256", secret)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest("hex");

        if (generated_signature !== razorpay_signature) {
            console.error("Signature verification failed for payment:", razorpay_payment_id);
            await Order.findByIdAndUpdate(order_id, { 
                paymentStatus: "Failed", 
                orderStatus: "Cancelled" 
            });
            return res.status(400).json({ 
                success: false, 
                message: "Payment verification failed" 
            });
        }

        // Step 2: Find the Order with populated product details
        const order = await Order.findById(order_id);

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        // Step 3: Update Order Status
        order.paymentStatus = "completed";
        order.orderStatus = "Confirmed";
        order.razorpayPaymentId = razorpay_payment_id;

        // Step 4: Update product stock for each item in the order
        for (const item of order.products) {
            const product = await Product.findById(item.productId);
            
            if (product) {
                // ✅ Ensure saleCount is a valid number before incrementing
                product.saleCount = Number(product.saleCount) || 0;
                product.saleCount += 1;

                const sizeIndex = product.sizes.findIndex(sizeObj => sizeObj.size === item.size);
                
                if (sizeIndex !== -1) {
                    // ✅ Ensure stock does not go below 0
                    product.sizes[sizeIndex].stock = Math.max(
                        0, 
                        product.sizes[sizeIndex].stock - item.quantity
                    );
                } else {
                    console.warn(`Size ${item.size} not found for product ${product._id}`);
                }

                await product.save();
            }
        }

        // Step 5: Clear the user's cart if they are logged in
        if (order.userId) {
            await Cart.findOneAndUpdate(
                { userId: order.userId },
                { $set: { product: [], totalPrice: 0 } }
            );
        }

        // Save the updated order
        await order.save();

        res.json({
            success: true,
            orderId: order._id,
            total: order.totalAmount,
            message: "Payment verified, order saved, and stock updated."
        });

    } catch (error) {
        console.error("Error verifying payment:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};






const returnOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log('Controller received orderId:', orderId);
        const { reason, customReason } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required' });
        }
        
       let order=await Order.findById(orderId);
       if(!order){
        return res.status(404).json({success:false,message:'order not found'})
       }
       order.orderStatus="Return Requested"
        await order.save();
        
        return res.status(200).json({ 
            success: true, 
            message: 'Return request for entire order submitted successfully' 
        });
        
    } catch (error) {
        console.error('Error processing full order return request:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const returnRequest = async (req, res) => {
    const Id = req.params.id;
    const { customReason } = req.body; 

    console.log('Order ID:', Id);
    console.log('Return Reason:', reason);
    console.log('Additional Details:', customReason);
    
    try {
        const order = await Order.findById(Id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.orderStatus === "Return Requested") {
            return res.status(400).json({ success: false, message: 'Product already return requested' });
        }
        
        order.orderStatus = 'Return Requested';
        order.returnReason = customReason;
        
        await order.save();
        
        return res.status(200).json({ success: true, message: "Product return requested successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
const returnPartialRequest = async (req, res) => {
    const { orderId, productOrderId } = req.params;
    const { productId, reason, customReason } = req.body;

    try {
        console.log(`Processing return for Order ID: ${orderId}, Product Order ID: ${productOrderId}, Product ID: ${productId}`);

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Ensure products array exists
        if (!order.products || order.products.length === 0) {
            return res.status(404).json({ success: false, message: 'No products found in order' });
        }

        // Find the specific product in the order
        const product = order.products.find(p => p.productOrderId.toString() === productOrderId && p.productId.toString() === productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        // Check if product has already been returned
        if (product.status === "Returned") {
            return res.status(400).json({ success: false, message: 'Product already returned' });
        }

        // Update product status and reason
        product.status = "Return Requested";
        product.returnReason = reason;
        product.additionalDetails = customReason;

        await order.save();

        return res.status(200).json({ success: true, message: 'Return request submitted successfully' });
    } catch (error) {
        console.error('Error processing return request:', error);
        return res.status(500).json({ success: false, message: 'Server error, please try again.' });
    }
};

const getWalletBalance = async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // ✅ Step 1: Check if the user is authenticated
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const user = await User.findById(userId).select("wallet");

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            balance: user.wallet || 0
        });

    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const payWithWallet = async (req, res) => {
    try {
        const userId = req.session.userId;
        const formData = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        // ✅ Step 1: Parse final amount
        const finalAmount = parseFloat(formData.finalAmount);

        // ✅ Step 2: Get coupon information
        const couponCode = formData.couponCode || '';
        const couponDiscount = parseFloat(formData.couponDiscount || 0);

        // ✅ Step 3: Fetch user's wallet balance from User model
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // ✅ Step 4: Check wallet balance
        if (user.wallet < finalAmount) {
            return res.status(400).json({
                success: false,
                insufficientBalance: true,
                message: 'Insufficient wallet balance',
                walletBalance: user.wallet
            });
        }

        // ✅ Step 5: Fetch cart items
        const cart = await Cart.findOne({ userId }).populate('product.productId');
        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).json({ success: false, message: 'No items in cart' });
        }

        // ✅ Step 6: Process shipping address
        const shippingAddress = {
            fullName: `${formData.firstName} ${formData.lastName}`,
            address: formData.streetAddress + (formData.landmark ? `, ${formData.landmark}` : ''),
            city: formData.city,
            state: formData.state,
            postalCode: formData.postCode,
            country: formData.country,
            phone: formData.phone
        };

        // ✅ Step 7: Map cart products to order format
        const orderProducts = cart.product.map(item => ({
            productId: item.productId._id,
            size: item.size,
            quantity: item.quantity,
            price: item.price
        }));

        // ✅ Fix: Store valid enum value for `paymentMethod`
        const newOrder = new Order({
            orderId: generateOrderId(),
            userId: userId,
            products: orderProducts,
            orderStatus: 'Confirmed',
            shippingAddress: shippingAddress,
            paymentMethod: ['wallet'], // ✅ FIXED: Ensure correct enum value
            paymentStatus: 'completed',
            totalAmount: finalAmount,
            couponDiscount: couponDiscount > 0 ? couponDiscount : undefined,
            couponCode: couponCode || undefined
        });

        await newOrder.save();

        // ✅ Step 9: Deduct amount from wallet
        user.wallet -= finalAmount;

        // ✅ Step 10: Add transaction to `walletHistory`
        user.walletHistory.push({
            date: new Date(),
            amount: -finalAmount,
        });

        await user.save();

        // ✅ Step 11: Empty the cart after order placement
        await Cart.findOneAndUpdate({ userId: userId }, { $set: { product: [], totalPrice: 0 } });

        // ✅ Step 12: Return success response
        res.status(200).json({
            success: true,
            message: 'Order placed successfully using wallet',
            orderId: newOrder.orderId,
            remainingBalance: user.wallet.toFixed(2)
        });

    } catch (error) {
        console.error('Error processing wallet payment:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};




module.exports = {
    checkoutPageInfo,
    cartCheckoutPage,
    buyNow,
    cancelOrder,
    viewPurchaseDetails,
    razorpayCreation,
    verifyRazorPay,
    returnOrder,
    returnRequest,
    returnPartialRequest,
    getWalletBalance,
    payWithWallet
};