const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema'); 

const cartPageInfo = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/login');
        }

        const cartData = await Cart.findOne({ userId }).populate('product.productId');

        // Filter out products that no longer exist
        if (cartData) {
            cartData.product = cartData.product.filter(item => item.productId !== null);
            cartData.totalPrice = cartData.product.reduce((acc, item) => acc + item.totalPrice, 0);
            await cartData.save(); // Save the updated cart
        }

        res.render('userCart', { cart: cartData });
    } catch (error) {
        console.error('Error fetching cart page info:', error);
        res.status(500).send('Internal Server Error');
    }
};

const addProductCart = async (req, res) => {  
    const { productId, size } = req.body;
    let quantity = 1;
    const userId = req.session.userId;

    // Convert size to Number type
    const sizeNumber = Number(size);
    
    if (isNaN(sizeNumber)) {
        return res.status(400).json({ success: false, message: 'Invalid size format' });
    }

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
            cart = new Cart({
                userId,
                product: [{
                    productId,
                    size: sizeNumber,  // Use the converted number
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity
                }]
            });
        } else {
            const existingProduct = cart.product.find(p => 
                p.productId.toString() === productId && p.size === sizeNumber
            );

            if (!existingProduct) {
                cart.product.push({
                    productId,
                    size: sizeNumber,  // Use the converted number
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity
                });
            } else {
                // If product exists with same size, increment quantity
                existingProduct.quantity += quantity;
                existingProduct.totalPrice = existingProduct.price * existingProduct.quantity;
            }

            // Recalculate total price
            cart.totalPrice = cart.product.reduce((acc, item) => acc + item.totalPrice, 0);
        }

        await cart.save();

        if (!req.session.cart) {
            req.session.cart = [];
            req.session.cart.push({ productId });
        }
        
        return res.status(200).json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const addProductToCartFromWishlist = async (req, res) => {  
    const { productId, size = 'S', quantity = 1 } = req.query;
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
            cart = new Cart({
                userId,
                product: [{
                    productId,
                    size,
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity
                }]
            });
        } else {
            const existingProduct = cart.product.find(p => 
                p.productId.toString() === productId && p.size === size
            );

            if (!existingProduct) {
                cart.product.push({
                    productId,
                    size,
                    quantity,
                    price: product.price,
                    totalPrice: product.price * quantity
                });
            } else {
                existingProduct.quantity += quantity;
                existingProduct.totalPrice = existingProduct.price * existingProduct.quantity;
            }

            cart.totalPrice = cart.product.reduce((acc, item) => acc + item.totalPrice, 0);
        }

        await cart.save();
        
        return res.status(200).json({ success: true, message: 'Product added to cart successfully' });
    } catch (error) {
        console.error('Error adding product to cart:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const updateProductQuantity = async (req, res) => {
    try {
        const productId = req.params.id;
        const { action, size } = req.body;
        const userId = req.session.userId;

        const cart = await Cart.findOne({ userId }).populate('product.productId');
        if (!cart) {
            return res.status(404).json({ 
                success: false, 
                message: 'Cart not found' 
            });
        }

        // Find the cart item with matching productId AND size
        const cartItem = cart.product.find(item => item.productId._id.toString() === productId && item.size === size);

        if (!cartItem) {
            return res.status(404).json({ 
                success: false, 
                message: 'Item not found in cart'
            });
        }

        // Find the product by productId
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        // Find the size in the product's sizes array
        const sizeData = product.sizes.find(s => s.size === size);
        if (!sizeData) {
            return res.status(400).json({
                success: false,
                message: `Size ${size} not available for this product`
            });
        }

        // Check if action is to increase or decrease quantity
        let updatedQuantity = cartItem.quantity;
        if (action === 'increase' && sizeData.stock > updatedQuantity) {
            updatedQuantity++;
        } else if (action === 'decrease' && updatedQuantity > 1) {
            updatedQuantity--;
        }

        // Check if the quantity is available for the selected size
        if (updatedQuantity > sizeData.stock) {
            return res.status(400).json({
                success: false,
                message: `Only ${sizeData.stock} items available in size ${size}`
            });
        }

        // Update the cart item with the new quantity
        cartItem.quantity = updatedQuantity;
        cartItem.totalPrice = cartItem.price * updatedQuantity;

        // Recalculate total price for the cart
        cart.totalPrice = cart.product.reduce((total, item) => total + item.totalPrice, 0);
        await cart.save(); // Save the updated cart

        // Respond with updated cart details
        res.json({
            success: true,
            cart,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        console.error('Update quantity error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

const deleteProductCart = async (req, res) => {
    const userId = req.session.userId;
    const productId = req.params.id;  

    try {
        if (!userId || !productId) {
            return res.status(400).json({
                success: false,
                message: 'User ID or Product ID is missing.'
            });
        }

        const updatedCart = await Cart.findOneAndUpdate(
            { userId }, 
            { $pull: { product: { productId } } },
            { new: true } 
        );

        if (!updatedCart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found or product not in cart.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Product removed from cart successfully.',
            cart: updatedCart
        });
    } catch (error) {
        console.error(error.message, 'internal server error....');
        return res.status(500).json({
            success: false,
            message: 'Internal server error.'
        });
    }
};

module.exports = {
    cartPageInfo,
    addProductCart,
    deleteProductCart,
    updateProductQuantity,
    addProductToCartFromWishlist
};