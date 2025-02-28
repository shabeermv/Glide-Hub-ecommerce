const Category = require('../../models/categorySchema');
const categoryOffer=require('../../models/categoryOffer');

const getCategory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;  
        const skip = (page - 1) * limit;

        const categoryData = await Category.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        res.render('category', {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.log(error);
        res.redirect('/pageerr');
    }
};

const addCategory = async (req, res) => {
    console.log('Incoming data:', req.body);
    const { name, description } = req.body;

    try {
        const existCategory = await Category.findOne({ name: new RegExp(name, 'i') });

        if (existCategory) {
            console.log('Category already exists:', existCategory);
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const newCategory = new Category({
            name,
            description,
            
        });
        const savedCategory = await newCategory.save();
        console.log('Category saved successfully:', savedCategory);
        return res.json({ success: true, message: 'Category added successfully' });
    } catch (error) {
        console.error('Error adding category:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};


const renderEditCategory = async (req,res) => {
    try {
        // console.log('ivde ethi............');
        
        const categoryId = req.params.id;
        // console.log('category id:',categoryId);
        if(!categoryId){
            return res.status(404).json({message:'category id found'});
        }
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('editCategory', { category });
    } catch (error) {
        console.error('Error while rendering edit category page:', error.message);
        res.status(500).json({message:"internal server eerror"});
    }
};


// Update category
const updateCategory = async (req, res) => {
    try {
        console.log('ivde ethi......');
        
        const categoryId = req.params.id;
        const { name, description } = req.body;

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name, description, updatedAt: new Date() },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category updated successfully', category: updatedCategory });
    } catch (error) {
        console.error('Error updating category:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Delete category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { isDeleted: true, updatedAt: Date.now() }, 
            { new: true } 
        );

        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category soft deleted successfully' });
    } catch (error) {
        console.error('Error soft deleting category:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const toggleCategoryStatus = async (req, res) => {
    try {
      const { id } = req.params;
      const { isDeleted } = req.body;
  
      const updatedCategory = await Category.findByIdAndUpdate(
        id,
        { isDeleted, updatedAt: Date.now() },
        { new: true } // Return the updated document
      );
  
      if (!updatedCategory) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
  
      res.status(200).json({
        success: true,
        message: `Category successfully ${isDeleted ? 'blocked' : 'unblocked'}`,
      });
    } catch (error) {
      console.error('Error toggling category status:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };


  const viewCategoryOfferInfo = async (req, res) => {
    try {
        const categories = await Category.find();
        const categoryOffers = await categoryOffer.find().populate('categoryId'); // Populate category details
        
        if (!categories) {
            return res.status(404).json({ success: false, message: 'Categories not found' });
        }

        res.render('categoryOffer', {
            categories,
            categoryOffers
        });
    } catch (error) {
        console.log(error.message, 'have an error in category offer');
        res.status(500).render('error', { message: 'Server error' });
    }
};

const addCategoryOffer = async (req, res) => {
    const { description, selectedCategory, discountType, discountValue, startDate, endDate } = req.body;

    // console.log('This is the req.body:', req.body);

    try {
        if (!description || !selectedCategory || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Validate discountType
        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({ success: false, message: 'Invalid discount type' });
        }

        // Create a new category offer
        const offerCategory = new categoryOffer({
            description,
            discountType,
            discountValue,
            startDate,
            endDate,
            categoryId: selectedCategory
        });

        await offerCategory.save(); // Save to MongoDB
        console.log('offer saved',offerCategory);
        

        return res.status(200).json({ success: true, message: 'Saved successfully.' });
    } catch (error) {
        console.error('Error in addCategoryOffer:', error);
        return res.status(500).json({ success: false, message: 'Internal server error on addCategoryOffer' });
    }
};

const deleteCategoryOffer=async(req,res)=>{
    const id=req.params.id;
    console.log(id,'id kitttiiii');
    try {
        const categorytype = await categoryOffer.findById(id);
    if(categorytype){
        await categoryOffer.findByIdAndDelete(id);
        return res.status(200).json({success:true,message:'category offer deleted'})
    }
    return res.status(404).json({success:false,message:'catgegory type not found'})
    } catch (error) {
        console.log(error.message,'this is the error message');

        return res.status(500).json({success:false,message:"internal server error in delete categoty offer"});
        
    }
    

}

const updateCategoryOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, selectedCategory, discountType, discountValue, startDate, endDate } = req.body;
        
        // Validate discount value based on type
        if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Percentage discount must be between 1 and 100' 
            });
        }
        
        if (discountType === 'fixed' && discountValue <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Fixed discount must be greater than 0' 
            });
        }
        
        // Check for date validity
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (end <= start) {
            return res.status(400).json({ 
                success: false, 
                message: 'End date must be after start date' 
            });
        }
        
        // Check if another offer exists for this category with overlapping dates
        const existingOffer = await categoryOffer.findOne({
            _id: { $ne: id }, // Exclude current offer
            categoryId: selectedCategory,
            $or: [
                { startDate: { $lte: start }, endDate: { $gte: start } }, // New offer starts during existing offer
                { startDate: { $lte: end }, endDate: { $gte: end } }, // New offer ends during existing offer
                { startDate: { $gte: start }, endDate: { $lte: end } } // New offer completely contains existing offer
            ]
        });
        
        if (existingOffer) {
            return res.status(400).json({ 
                success: false, 
                message: 'Another offer already exists for this category during the specified date range' 
            });
        }
        
        // Update the offer
        const updatedOffer = await categoryOffer.findByIdAndUpdate(
            id,
            {
                description,
                categoryId: selectedCategory,
                discountType,
                discountValue,
                startDate,
                endDate
            },
            { new: true }
        );
        
        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: 'Category offer not found' });
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'Category offer updated successfully',
            offer: updatedOffer
        });
    } catch (error) {
        console.error('Error updating category offer:', error);
        res.status(500).json({ success: false, message: 'Failed to update category offer' });
    }
};

module.exports = {
    getCategory,
    addCategory,
    renderEditCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    viewCategoryOfferInfo,
    addCategoryOffer,
    deleteCategoryOffer,
    updateCategoryOffer // Removed the extra comma here
};
