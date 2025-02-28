const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const CategoryOffer = require('../../models/categoryOffer');
const ProductOffer = require('../../models/productOffer');


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

            // Fetch product and category offers
            const productOffer = await ProductOffer.findOne({ productId });
            const categoryOffer = await CategoryOffer.findOne({ categoryId: product.category._id });

            let finalPrice = product.price;
            let appliedOffer = null;

            // Apply product offer first if available
            if (productOffer) {
                finalPrice = productOffer.discountType === 'percentage' 
                    ? product.price - (product.price * productOffer.discountValue / 100)
                    : product.price - productOffer.discountValue;
                appliedOffer = productOffer;
            } 
            // If no product offer, apply category offer
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

                // Fetch category offer
                const categoryOffer = await categoryOffer.findOne({ categoryId: product.category });

                // Fetch product offer
                const productOffer = await productOffer.findOne({ productId: product._id });

                // Apply product offer first if available
                if (productOffer) {
                    finalPrice = productOffer.discountType === 'percentage' 
                        ? product.price - (product.price * productOffer.discountValue / 100)
                        : product.price - productOffer.discountValue;
                    appliedOffer = productOffer;
                } 
                // If no product offer, apply category offer
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
        return res.status(500).send('Internal server error');
    }
};


const cartCheckoutPage = async (req, res) => {
    const userId = req.session.userId;
    
    try {
        const user = await User.findById(userId);
        
        const cart = await Cart.findOne({ userId })
            .populate('product.productId', 'title price image');
        
        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).render('checkout', { 
                error: 'Your cart is empty',
                products: [],
                user: {
                    email: user.email,
                    username: user.username,
                    contact: user.contact,
                    address: user.address && user.address.length > 0 ? user.address[0] : null
                }
            });
        }

        const products = cart.product.map(item => ({
            productId: item.productId._id,
            title: item.productId.title,
            price: item.price,
            quantity: item.quantity,
            size: item.size,
            totalPrice: item.totalPrice,
            image: item.productId.image && item.productId.image[0] ? item.productId.image[0] : 'default-product.jpg'
        }));

        const defaultAddress = user.address && user.address.length > 0 ? user.address[0] : null;
        
        res.render('checkout', { 
            products,
            totalPrice: cart.totalPrice,
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
        return res.status(500).render('checkout', {
            error: 'Internal server error',
            products: [],
            user: null,
            totalPrice: 0
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
            size: item.size, // This should be a string based on cart data
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
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
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

        order.orderStatus = 'Cancelled';
        await order.save();

        res.status(200).json({
            success: true,
            message: 'Order cancelled successfully'
        });

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling order'
        });
    }
};

const viewOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.userId;
        
        const order = await Order.findById(orderId)
            .populate({
                path: 'products.productId',
                select: 'name price image' // Selecting product name, price, and image
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
        
        res.render('orderDetails', {  
            order: order,
            user: order.userId
        });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).render('error', {
            message: 'Error retrieving order details'
        });
    }
};


module.exports = {
    checkoutPageInfo,
    cartCheckoutPage,
    buyNow,
    cancelOrder,
    viewOrderDetails
};