const Category=require('../../models/categorySchema');

const getCategory=async(req,res)=>{
    try {
        const page=parseInt(req.query.page)||1
        const limit=4
        const skip=(page-1)*limit;

        const categoryData=await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories=await Category.countDocuments();
        const totalPages=Math.ceil(totalCategories/limit)
        res.render('category',{
            cat:categoryData,
            currentPage:page,
            totalPage:totalPages,
            totalCategories:totalCategories

        })
    } catch (error) {
        console.log(error);
        res.redirect('/pageerr');
    }
}

const addCategory = async (req, res) => {
    console.log('Incoming data:', req.body);
    const { name, description, offer } = req.body;

    try {
        const existCategory = await Category.findOne({ name });
        if (existCategory) {
            console.log('Category already exists:', existCategory);
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const newCategory = new Category({
            name,
            description,
            offer,
        });
        const savedCategory = await newCategory.save();
        console.log('Category saved successfully:', savedCategory);
        return res.json({ success: true, message: 'Category added successfully' });
    } catch (error) {
        console.error('Error adding category:', error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const renderEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('editCategory', { category });
    } catch (error) {
        console.error('Error while rendering edit category page:', error.message);
        res.status(500).send('Internal server error');
    }
};



const updateCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { name, description, offer } = req.body;

        

        const updatedCategory = await Category.findByIdAndUpdate(
            categoryId,
            { name, description, offer, updatedAt: new Date() },
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

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params; // Get category ID from URL parameters
        const deletedCategory = await Category.findByIdAndDelete(id); // Delete category by ID

        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};






module.exports={
    
    getCategory,
    addCategory,
    renderEditCategory,
    updateCategory,
    deleteCategory
}