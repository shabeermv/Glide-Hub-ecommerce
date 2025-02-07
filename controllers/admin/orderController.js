const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const User=require('../../models/userSchema');
const Order=require('../../models/orderSchema');


const userOrdersInfo = async (req, res) => {
    try {
        // Get all orders and populate both user and product details
        const orderData = await Order.find({})
            .populate({
                path: 'products.productId',
                select: 'title price'
            })
            .populate({
                path: 'userId',
                select: 'name email' // Include user details you want to show
            })
            .sort({ createdAt: -1 }); // Sort by newest first

        // Calculate totals and format data
        const processedOrders = orderData.map(order => {
            // Ensure order has an orderId
            if (!order.orderId) {
                order.orderId = order._id.toString().slice(-6).toUpperCase();
            }

            // Calculate total for each product and overall order
            let orderTotal = 0;
            order.products.forEach(product => {
                if (product.productId && product.productId.price) {
                    product.total = product.productId.price * product.quantity;
                    orderTotal += product.total;
                }
            });
            order.totalAmount = orderTotal;

            return order;
        });

        res.render('orders', { 
            orderData: processedOrders,
            isAdmin: true // Flag to differentiate admin view
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        res.render('orders', { 
            orderData: [],
            error: 'Unable to fetch orders. Please try again later.',
            isAdmin: true
        });
    }
};

const changeOrderStatus = async (req, res) => {
    const { orderId, status } = req.body;
    console.log('req.body vannnn', req.body);

    try {
        // Find the order by orderId
        const order = await Order.findById(orderId);
        console.log('order kittiii', order);

        if (!order) {
            return res.status(404).json({success:false ,message: 'Order not found' });
        }

        
        const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled']; 
        if (!validStatuses.includes(status)) {
            return res.status(400).json({success:false, message: 'Invalid status provided' });
        }

        // Update the order status
        order.orderStatus = status;

        // Save the updated order
        await order.save();

        res.status(200).json({success:true ,message: 'Order status updated successfully', order });
    } catch (error) {
        console.log(error.message, 'feeling error in order');
        res.status(500).json({ message: 'Internal server error' });
    }
};



module.exports={
    userOrdersInfo,
    changeOrderStatus
}