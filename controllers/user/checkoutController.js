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

        const defaultAddress = user.address?.length > 0 ? user.address[0] : null;

        res.render('checkout', { 
            products,
            totalPrice,
            user: {
                email: user.email,
                username: user.username,
                contact: user.contact,
                address: defaultAddress
            }
        });
        
    } catch (error) {
        console.error('Error fetching checkout data:', error);
        next(error)    }
};


const cartCheckoutPage = async (req, res) => {
    const userId = req.session.userId;
    
    try {
        const user = await User.findById(userId);

        const cart = await Cart.findOne({ userId })
            .populate('product.productId', 'title price image hasDiscount originalPrice discountedPrice');

        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).render('checkout', { 
                error: 'Your cart is empty',
                products: [],
                totalPrice: 0,
                user: {
                    email: user.email,
                    username: user.username,
                    contact: user.contact,
                    address: user.address && user.address.length > 0 ? user.address[0] : null
                }
            });
        }

        let totalPrice = 0;
        const products = cart.product.map(item => {
            const originalPrice = item.productId.originalPrice || item.productId.price || 0;
            const discountedPrice = item.productId.hasDiscount ? item.productId.discountedPrice : originalPrice;
            const totalItemPrice = discountedPrice * item.quantity;
            totalPrice += totalItemPrice;

            return {
                productId: item.productId._id,
                title: item.productId.title,
                hasDiscount: item.productId.hasDiscount,
                originalPrice: originalPrice.toFixed(2),
                discountedPrice: discountedPrice.toFixed(2),
                quantity: item.quantity,
                size: item.size,
                totalPrice: totalItemPrice.toFixed(2),
                image: item.productId.image?.[0] || 'default-product.jpg'
            };
        });

        const defaultAddress = user.address?.length > 0 ? user.address[0] : null;

        res.render('checkout', { 
            products,
            totalPrice: totalPrice.toFixed(2),
            user: {
                email: user.email,
                username: user.username,
                contact: user.contact,
                address: defaultAddress
            },
            error: null
        });

    } catch (error) {
        console.error('Error fetching cart checkout data:', error);
        next(error)
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

        const cart = await Cart.findOne({ userId }).populate('product.productId');

        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).json({ success: false, message: 'No items in cart' });
        }

        const totalPrice = cart.product.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        const mapPaymentMethod = (paymentMethod) => {
            const paymentMethodMap = {
                'Direct bank transfer': 'UPI',
                'Check payments': 'Credit Card',
                'Cash on delivery': 'Cash on Delivery',
                'PayPal': 'PayPal',
                'Credit Card (Stripe)': 'Credit Card'
            };
            return paymentMethodMap[paymentMethod] || 'Cash on Delivery';
        };

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
            orderStatus: 'Pending',
            shippingAddress: shippingAddress,
            paymentMethod: [mapPaymentMethod(formData.paymentMethod)],
            paymentStatus: 'Pending',
            totalAmount: totalPrice
        });

        await newOrder.save();

        for (const item of cart.product) {
            const product = await Product.findById(item.productId._id);
        
            if (product) {
                const sizeIndex = product.sizes.findIndex(sizeObj => sizeObj.size === item.size);
        
                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].stock = Math.max(0, product.sizes[sizeIndex].stock - item.quantity);
                } else {
                    console.warn(`Size ${item.size} not found for product ${product._id}`);
                }
        
                await product.save();
            }
        }
        
        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { product: [], totalPrice: 0 } }
        );

        res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder.orderId,
            total: totalPrice.toFixed(2)
        });

    } catch (error) {
        console.error('Error in buyNow controller:', error);
        next(error)
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
        next(error)
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
        next(error)
    }
};


//   console.log('Environment variables check:');
// console.log('RAZOPAY_ID_KEY:', process.env.RAZORPAY_ID_KEY);
// console.log('RAZOPAY_SECRET_KEY:', process.env.RAZORPAY_SECRET_KEY);

const razorpayCreation = async (req, res) => {
    try {
        const formData = req.body;
        let subtotal = parseFloat(formData.totalAmount || 0);
        const userId = req.session.userId || null;

        // Get cart data with populated product information
        let cart = null;
        if (userId) {
            cart = await Cart.findOne({ userId }).populate("product.productId");
        }

        // Calculate subtotal from cart if not provided in form
        if (!subtotal && cart && cart.product.length > 0) {
            subtotal = cart.product.reduce((total, item) => {
                // Correctly determine price based on discount status
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

        // Generate a unique order ID
        const orderId = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Get user information if logged in
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

        // Prepare order products array with correct product information
        let orderProducts = [];
        if (cart && cart.product.length > 0) {
            orderProducts = cart.product.map(item => {
                // Get the correct price based on discount status
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

        // Create the order in your database
        const order = await Order.create({
            orderId: orderId,
            userId: userId,
            guestEmail: userId ? undefined : formData.email || "anonymous",
            isGuestCheckout: !userId,
            products: orderProducts,  
            totalAmount: subtotal,
            paymentStatus: "Pending",
            paymentMethod: ["Credit Card"],
            shippingAddress
        });

        // Create Razorpay order
        const amountInPaise = Math.round(subtotal * 100);
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_ID_KEY,
            key_secret: process.env.RAZORPAY_SECRET_KEY
        });

        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: order._id.toString(),
            notes: {
                orderType: "Product Purchase",
                customer_name: shippingAddress.fullName,
                customer_email: shippingAddress.email
            }
        });

        // Update order with Razorpay order ID
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
        next(error)
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
                // Find the size index in the product's sizes array
                const sizeIndex = product.sizes.findIndex(sizeObj => 
                    sizeObj.size === item.size
                );
                
                if (sizeIndex !== -1) {
                    // Update stock, ensuring it doesn't go below 0
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
        next(error)
    }
};






const returnOrder=async(req,res)=>{
    const { orderId, reason, customReason } = req.body; 
    console.log('reason van',req.body)
    const order=await Order.findById(orderId);
    try {
        if(order.orderStatus==='Returned'){
            console.log('order already returned...')
            return res.status(400).json({success:false,message:'order already cancelled'})
        }
        order.orderStatus = 'Returned';
        order.cancellationReason = reason ? reason : customReason;

        await order.save()
        console.log('order return process successful...')
        return res.status(200).json({success:true,message:'order successfully return process completed'})
        
    } catch (error) {
        console.log('error on return order');
        next(error)
        }
}


module.exports = {
    checkoutPageInfo,
    cartCheckoutPage,
    buyNow,
    cancelOrder,
    viewPurchaseDetails,
    razorpayCreation,
    verifyRazorPay,
    returnOrder
};