const Coupon = require('../../models/couponSchema');

const couponPageInfo = async (req, res) => {
    try {
        const coupons = await Coupon.find({});
        res.render('coupon', { coupons });
    } catch (error) {
        console.error('Error fetching coupons:', error);
        next(error)
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

        if (discount === 'percentage' && (parsedDiscountValue < 0 || parsedDiscountValue > 100)) {
            return res.status(400).json({ message: "Percentage discount must be between 0 and 100!" });
        }

        if (discount === 'fixed' && parsedDiscountValue < 0) {
            return res.status(400).json({ message: "Fixed discount cannot be negative!" });
        }

        const couponData = new Coupon({
            name,
            code,
            discount, 
            discountValue: parsedDiscountValue,
            expireDate: new Date(expireDate),
            minPurchase: parsedMinPurchase
        });

        await couponData.save();

        console.log("Received Coupon Data:", couponData);

        res.status(201).json({ message: "Coupon added successfully!", data: couponData });
    } catch (error) {
        console.error("Error adding coupon:", error);
        next(error)
        }
};


const deleteCoupon = async (req, res) => {
    const couponId = req.params.id; 

    console.log("Coupon ID (Backend):", couponId);

    try {
        const coupon = await Coupon.findByIdAndDelete(couponId); 

        if (!coupon) { 
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        res.status(200).json({ success: true, message: "Coupon successfully deleted." });

    } catch (error) {
        console.error("Error deleting coupon:", error);
        next(error)    }
};

const editCouponDetails=async(req,res)=>{
   const couponId=req.params.id;
   try {
    const coupon=await Coupon.findById(couponId);
    if (!coupon) { 
        res.status(404); // ✅ Set status before calling next()
        return next(new Error("Coupon not found"));
    }
    res.render('editCoupon',{coupon})
    
   } catch (error) {
    console.log(error.message);
    next(error)
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
        next(error)
        }
};

const getEligibleCoupons = async (req, res) => {
    try {
        const { cartTotal } = req.query;
        const total = parseFloat(cartTotal);
        
        if (isNaN(total)) {
            return res.status(400).json({ success: false, message: "Invalid cart total" });
        }
        
        const eligibleCoupons = await Coupon.find({
            minPurchase: { $lte: total },
            expireDate: { $gt: new Date() }
        });
        
        res.status(200).json({ success: true, coupons: eligibleCoupons });
    } catch (error) {
        console.error("Error fetching eligible coupons:", error);
        next(error)
        }
};



const applyCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;
        const userId = req.session.userId;

        // Find the coupon in the database
        const coupon = await Coupon.findOne({ 
            code: couponCode,
            minPurchase: { $lte: subtotal },
            expireDate: { $gte: new Date() }
        });

        if (!coupon) {
            return res.status(400).json({
                success: false,
                message: 'Invalid coupon code or minimum purchase not met'
            });
        }

        // Check if coupon has already been used by this user
        if (coupon.usedBy && coupon.usedBy.includes(userId)) {
            return res.status(400).json({
                success: false,
                message: 'You have already used this coupon'
            });
        }

        // Calculate discount
        let discount = 0;
        let discountPercentage = 0;
        
        if (coupon.discount === 'percentage') {
            // Store the percentage for display purposes
            discountPercentage = coupon.discountValue;
            
            // Calculate the discount amount
            discount = (subtotal * coupon.discountValue) / 100;
            
            // Apply maximum discount limit if specified
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount;
            }
        } else {
            // Fixed amount discount
            discount = coupon.discountValue;
        }

        // Calculate discounted total
        const discountedTotal = subtotal - discount;

        // If this is a real order (not just preview), mark coupon as used
        if (req.body.finalizeOrder) {
            // Add user to usedBy array
            if (userId) {
                await Coupon.findByIdAndUpdate(
                    coupon._id,
                    { $addToSet: { usedBy: userId } }
                );
            }
        }

        return res.json({
            success: true,
            discount: discount,
            discountPercentage: discountPercentage,
            discountedTotal: discountedTotal,
            couponCode: couponCode,
            discountType: coupon.discount
        });

    } catch (error) {
        console.error('Error applying coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
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