const Category = require('../../models/categorySchema');

// Get categories with pagination
const getCategory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 4;  // Number of categories per page
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

// Add a new category
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
        // if(!categoryId){
        //     return res.status(404).json({message:'category id found'});
        // }
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
module.exports = {
    getCategory,
    addCategory,
    renderEditCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus
};
