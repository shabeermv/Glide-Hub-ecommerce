const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');

const checkoutPageInfo = async (req, res) => {
    const userId = req.session.userId;
    const productId = req.params.id; // Optional product ID for single product checkout
    
    try {
        // Fetch user details
        const user = await User.findById(userId);
        
        let products = [];
        let totalPrice = 0;

        if (productId) {
            // Single product checkout
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).render('checkout', { 
                    error: 'Product not found',
                    products: [],
                    user: {
                        email: user.email,
                        username: user.username,
                        contact: user.contact,
                        address: user.address && user.address.length > 0 ? user.address[0] : null
                    }
                });
            }

            // Fetch the cart to get the quantity and size for the product
            const cart = await Cart.findOne({ userId });
            const cartItem = cart ? cart.product.find(item => item.productId.toString() === productId) : null;

            products = [{
                productId: product._id,
                title: product.title,
                price: product.price,
                quantity: cartItem ? cartItem.quantity : 1, // Use cart quantity if available, else default to 1
                size: cartItem ? cartItem.size : 'M', // Use cart size if available, else default to 'M'
                totalPrice: product.price * (cartItem ? cartItem.quantity : 1),
                image: product.image && product.image[0] ? product.image[0] : 'default-product.jpg'
            }];
            totalPrice = product.price * (cartItem ? cartItem.quantity : 1);
        } else {
            // Cart checkout
            const cart = await Cart.findOne({ userId })
                .populate('product.productId', 'title price image');
            
            // If no cart or cart is empty
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

            products = cart.product.map(item => ({
                productId: item.productId._id,
                title: item.productId.title,
                price: item.price,
                quantity: item.quantity,
                size: item.size,
                totalPrice: item.totalPrice,
                image: item.productId.image && item.productId.image[0] ? item.productId.image[0] : 'default-product.jpg'
            }));
            totalPrice = cart.totalPrice;
        }

        // Get the default address (first address in the array)
        const defaultAddress = user.address && user.address.length > 0 ? user.address[0] : null;
        
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
        // Fetch user details
        const user = await User.findById(userId);
        
        // Fetch cart with populated product details
        const cart = await Cart.findOne({ userId })
            .populate('product.productId', 'title price image');
        
        // If no cart or cart is empty
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

        // Transform cart products for checkout
        const products = cart.product.map(item => ({
            productId: item.productId._id,
            title: item.productId.title,
            price: item.price,
            quantity: item.quantity,
            size: item.size,
            totalPrice: item.totalPrice,
            image: item.productId.image && item.productId.image[0] ? item.productId.image[0] : 'default-product.jpg'
        }));

        // Get the default address (first address in the array)
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

        // Get cart items for the user
        const cart = await Cart.findOne({ userId }).populate('product.productId');

        if (!cart || !cart.product || cart.product.length === 0) {
            return res.status(400).json({ success: false, message: 'No items in cart' });
        }

        // Calculate total price from cart
        const totalPrice = cart.product.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        // Map payment method to allowed enum values
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

        // Create shipping address object
        const shippingAddress = {
            fullName: `${formData.firstName} ${formData.lastName}`,
            address: formData.streetAddress + (formData.landmark ? `, ${formData.landmark}` : ''),
            city: formData.city,
            state: formData.state,
            postalCode: formData.postCode,
            country: formData.country,
            phone: formData.phone
        };

        // Create products array for order
        const orderProducts = cart.product.map(item => ({
            productId: item.productId._id,
            size: item.size, // Include size if applicable
            quantity: item.quantity,
            price: item.price
        }));

        // Create new order
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

        // Save the order
        await newOrder.save();

        for (const item of cart.product) {
            const product = await Product.findById(item.productId._id);
        
            if (product) {
                const sizeIndex = product.sizes.findIndex(sizeObj => sizeObj.size === item.size);
        
                if (sizeIndex !== -1) {
                    product.sizes[sizeIndex].stock = Math.max(0, product.sizes[sizeIndex].stock - item.quantity);
                } else {
                    // Optional: Handle case where size is not found
                    console.warn(`Size ${item.size} not found for product ${product._id}`);
                }
        
                await product.save();
            }
        }
        
        // Clear the cart after successful order creation
        await Cart.findOneAndUpdate(
            { userId: userId },
            { $set: { product: [], totalPrice: 0 } }
        );

        // Send success response
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

        // Find the order
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Restore stock for each canceled product
        for (const item of order.products) {
            const product = await Product.findById(item.productId);

            if (product) {
                // Ensure sizes array exists
                if (!Array.isArray(product.sizes)) {
                    console.warn(`Product ${product._id} has no sizes array`);
                    continue;
                }

                // Find the correct size in the sizes array
                const sizeIndex = product.sizes.findIndex(sizeObj => sizeObj.size === item.size);

                if (sizeIndex !== -1) {
                    // Add back the canceled quantity to stock if size exists
                    product.sizes[sizeIndex].stock += item.quantity;
                } else {
                    // If size does not exist, create a new entry for the canceled size
                    product.sizes.push({
                        size: item.size,
                        stock: item.quantity,  // Add the canceled quantity to stock
                        canceled: true  // Mark this size as a canceled stock
                    });
                }

                // Save the updated product stock
                await product.save();
            }
        }

        // Update order status to "Cancelled"
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



module.exports = {
    checkoutPageInfo,
    cartCheckoutPage,
    buyNow,
    cancelOrder
};