const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');

const wishlistPageInfo = async (req, res) => {
    if (req.session.user) {
        try {
            const page = parseInt(req.query.page, 10) || 1; 
            const limit = parseInt(req.query.limit, 10) || 5; 
            const skip = (page - 1) * limit;

            const wishlist = await Wishlist.findOne({ userId: req.session.userId })
                .populate({
                    path: 'products.productId',
                    options: { skip, limit }  // ✅ This ensures MongoDB paginates properly
                })
                .select('products')
                .lean();

            if (!wishlist || !wishlist.products || wishlist.products.length === 0) {
                console.log('wishlist')
                return res.render('wishlist', {
                    wishlist:wishlist?.products || [],
                    currentPage: page,
                    totalPages: 0,
                });
            }

            const totalProducts = await Wishlist.aggregate([
                { $match: { userId: req.session.userId } },
                { $project: { totalItems: { $size: "$products" } } }
            ]);

            const totalPages = Math.ceil((totalProducts[0]?.totalItems || 0) / limit);

            res.render('wishlist', {
                wishlist: wishlist.products,  // ✅ Already paginated
                currentPage: page,
                totalPages,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    } else {
        res.redirect('/login');
    }
};

const addProductWishlist = async (req, res) => {
    const productId = req.params.id;  
    const userId = req.session.userId;

    try {
        if (!userId || !productId) {
            return res.status(400).json({ success: false, message: "userId or productId is missing" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const productExists = wishlist.products.some(item => item.productId.toString() === productId);

        if (productExists) {
            return res.status(400).json({ success: false, message: "Product already in wishlist" });
        }

        wishlist.products.push({ productId });

        await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const removeWishlistItem = async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.userId;

    try {
        // console.log('Product ID:', productId);
        // console.log('User ID:', userId);

        // Validate input
        if (!userId || !productId) {
            return res.status(400).json({
                success: false,
                message: 'User ID or Product ID is missing.',
            });
        }

        // Update wishlist
        const updatedWishList = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { products: { productId } } },
            { new: true }
        );

        if (!updatedWishList) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Product deleted from wishlist successfully.',
        });
    } catch (error) {
        console.error('Backend Error:', error.message); 
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.',
        });
    }
};

module.exports = {
    wishlistPageInfo,
    addProductWishlist,
    removeWishlistItem
};
