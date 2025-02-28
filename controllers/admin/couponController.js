const Coupon = require('../../models/couponSchema');

const couponPageInfo = async (req, res) => {
    try {
        // Use find() instead of findOne() to get all coupons
        const coupons = await Coupon.find({});
        res.render('coupon', { coupons }); // Make sure the path matches your view structure
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).render('error', { message: 'Error loading coupons' });
    }
};


const addCoupon = async (req, res) => {
    try {
        const { name, code, discount, discountValue, expireDate, minPurchase } = req.body;

        if (!name || !code || !discount || !discountValue || !expireDate || !minPurchase) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const parsedDiscountValue = parseFloat(discountValue);
        const parsedMinPurchase = parseFloat(minPurchase);

        if (isNaN(parsedDiscountValue) || isNaN(parsedMinPurchase)) {
            return res.status(400).json({ message: "Invalid discount or minPurchase value!" });
        }

        // Validate discount value based on type
        if (discount === 'percentage' && (parsedDiscountValue < 0 || parsedDiscountValue > 100)) {
            return res.status(400).json({ message: "Percentage discount must be between 0 and 100!" });
        }

        if (discount === 'fixed' && parsedDiscountValue < 0) {
            return res.status(400).json({ message: "Fixed discount cannot be negative!" });
        }

        const couponData = new Coupon({
            name,
            code,
            discount, // 'percentage' or 'fixed'
            discountValue: parsedDiscountValue,
            expireDate: new Date(expireDate),
            minPurchase: parsedMinPurchase
        });

        await couponData.save();

        console.log("Received Coupon Data:", couponData);

        res.status(201).json({ message: "Coupon added successfully!", data: couponData });
    } catch (error) {
        console.error("Error adding coupon:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const deleteCoupon = async (req, res) => {
    const couponId = req.params.id; // Fix: Use 'id' (not 'Id')

    console.log("Coupon ID (Backend):", couponId);

    try {
        const coupon = await Coupon.findByIdAndDelete(couponId); // Fix: Remove {}

        if (!coupon) { // Fix: Check for 'null' instead of returning on success
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({ success: true, message: "Coupon successfully deleted." });

    } catch (error) {
        console.error("Error deleting coupon:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const editCouponDetails=async(req,res)=>{
   const couponId=req.params.id;
   try {
    const coupon=await Coupon.findById(couponId);
    if(!coupon){
        alert('coupon not found')
    }
    res.render('editCoupon',{coupon})
    
   } catch (error) {
    console.log(error.message);
   }
}


const editCoupon = async (req, res) => {
    const couponId = req.params.id;
    console.log('Coupon ID to edit:', couponId);
    console.log('Incoming updated details:', req.body);

    try {
        const { name, code, discount, discountValue, expireDate, minPurchase } = req.body;

        const parsedDiscountValue = parseFloat(discountValue);
        const parsedMinPurchase = parseFloat(minPurchase);

        if (!name || !code || !discount || !discountValue || !expireDate || !minPurchase) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        if (isNaN(parsedDiscountValue) || isNaN(parsedMinPurchase)) {
            return res.status(400).json({ message: "Invalid discount or minPurchase value!" });
        }

        if (discount === 'percentage' && (parsedDiscountValue < 0 || parsedDiscountValue > 100)) {
            return res.status(400).json({ message: "Percentage discount must be between 0 and 100!" });
        }

        if (discount === 'fixed' && parsedDiscountValue < 0) {
            return res.status(400).json({ message: "Fixed discount cannot be negative!" });
        }

        
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponId,
            {
                name,
                code,
                discount,
                discountValue: parsedDiscountValue,
                expireDate: new Date(expireDate),
                minPurchase: parsedMinPurchase,
            },
            { new: true } 
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: "Coupon not found!" });
        }

        console.log("Updated Coupon Data:", updatedCoupon);

        res.status(200).json({ message: "Coupon updated successfully!", updatedCoupon });

    } catch (error) {
        console.error("Error updating coupon:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getEligibleCoupons = async (req, res) => {
    try {
        const { cartTotal } = req.query;
        const total = parseFloat(cartTotal);
        
        if (isNaN(total)) {
            return res.status(400).json({ success: false, message: "Invalid cart total" });
        }
        
        // Find all valid coupons where minPurchase <= cart total and not expired
        const eligibleCoupons = await Coupon.find({
            minPurchase: { $lte: total },
            expireDate: { $gt: new Date() }
        });
        
        res.status(200).json({ success: true, coupons: eligibleCoupons });
    } catch (error) {
        console.error("Error fetching eligible coupons:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// New function to apply a coupon to the cart
const applyCoupon = async (req, res) => {
    try {
        const { code, cartTotal } = req.body;
        
        if (!code || !cartTotal) {
            return res.status(400).json({ success: false, message: "Missing coupon code or cart total" });
        }
        
        const total = parseFloat(cartTotal);
        
        if (isNaN(total)) {
            return res.status(400).json({ success: false, message: "Invalid cart total" });
        }
        
        // Find the coupon with the given code
        const coupon = await Coupon.findOne({ 
            code: code,
            expireDate: { $gt: new Date() }
        });
        
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Invalid or expired coupon" });
        }
        
        // Check if cart total meets minimum purchase requirement
        if (total < coupon.minPurchase) {
            return res.status(400).json({ 
                success: false, 
                message: `Minimum purchase of ₹${coupon.minPurchase} required for this coupon` 
            });
        }
        
        // Calculate discount
        let discountAmount = 0;
        if (coupon.discount === 'percentage') {
            discountAmount = (total * coupon.discountValue) / 100;
        } else { // fixed
            discountAmount = coupon.discountValue;
        }
        
        // Calculate new total
        const newTotal = total - discountAmount;
        
        // Return the results
        res.status(200).json({
            success: true,
            coupon: {
                name: coupon.name,
                code: coupon.code,
                discountType: coupon.discount,
                discountValue: coupon.discountValue
            },
            discountAmount,
            newTotal
        });
        
    } catch (error) {
        console.error("Error applying coupon:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};




module.exports = {
    couponPageInfo,
    addCoupon,
    deleteCoupon,
    editCouponDetails,
    editCoupon,
    getEligibleCoupons,
    applyCoupon
};