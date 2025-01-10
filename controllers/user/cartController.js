const Cart=require('../../models/cartSchema');
const User=require('../../models/userSchema');
const Product=require('../../models/productSchema');


const cartPageInfo = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }

        const cartData = await Cart.findOne({ userId }).populate('product.productId');
        
        // Calculate totalPrice if it's not already set
        if (cartData && !cartData.totalPrice) {
            cartData.totalPrice = cartData.product.reduce((acc, item) => acc + item.totalPrice, 0);
        }

        res.render('userCart', { cart: cartData });
    } catch (error) {
        console.error('Error fetching cart page info:', error);
        res.status(500).send('Internal Server Error');
    }
};

const addProductCart = async (req, res) => {
    const { productId, quantity, size, color } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    try {
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            // Create a new cart for the user
            cart = new Cart({
                userId,
                product: [{
                    productId,
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity,
                    totalPriceWithOffer: product.price * quantity, // Adjust based on offer logic
                    offerDiscount: 0, // Adjust based on offer logic
                }],
                totalPrice: product.price * quantity // Initialize totalPrice for new cart
            });
        } else {
            // Check if the product already exists in the cart
            const existingProduct = cart.product.find(p => p.productId.toString() === productId);
            if (existingProduct) {
                existingProduct.quantity += parseInt(quantity, 10);
                existingProduct.totalPrice = existingProduct.price * existingProduct.quantity;
                existingProduct.totalPriceWithOffer = existingProduct.totalPrice; // Adjust based on offer logic
            } else {
                // Add new product to the cart
                cart.product.push({
                    productId,
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity,
                    totalPriceWithOffer: product.price * quantity, // Adjust based on offer logic
                    offerDiscount: 0, // Adjust based on offer logic
                });
            }

            // Recalculate the total price for the cart
            cart.totalPrice = cart.product.reduce((acc, item) => acc + item.totalPrice, 0);
        }

        await cart.save();
        return res.status(200).json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};




module.exports={
    cartPageInfo,
    addProductCart
}