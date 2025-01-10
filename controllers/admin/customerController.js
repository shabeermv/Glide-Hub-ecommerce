const User = require('../../models/userSchema');

const userInfo = async (req, res) => {
    try {
        // Capture the search query and set default to empty string if not provided
        const search = req.query.search || ''; 
        
        // Get the current page from the query parameter, defaulting to 1 if not provided
        const page = parseInt(req.query.page) || 1; 
        
        // Set the number of users per page
        const limit = 6; 

        // Ensure that the page is at least 1
        const validPage = Math.max(page, 1);

        // Prepare a regex search pattern for case-insensitive search
        const searchQuery = new RegExp(search, 'i');

        // Find the users matching the search query with pagination
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: searchQuery } },  // Search by name
                { email: { $regex: searchQuery } }  // Search by email
            ]
        })
        .limit(limit)
        .skip((validPage - 1) * limit) // Skip results for pagination
        .exec();

        // Get the count of users matching the search query (for pagination)
        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: searchQuery } },
                { email: { $regex: searchQuery } }
            ]
        });

        const totalPages = Math.ceil(count / limit);

        res.render('users', {
            data: userData,
            currentPage: validPage,
            totalPages,
            search, 
        });
    } catch (error) {
        console.error('Error in userInfo:', error);
        res.status(500).send('An error occurred while fetching user data');
    }
};

const toggleBlockStatus = async (req, res) => {
    try {
        const { userId } = req.params; 
        const { isBlocked } = req.body; 
    
        const user = await User.findById(userId);
    
        if (!user) {
            throw new Error('user not found...')
        }
    
        user.isBlocked = isBlocked;
    
        await user.save();
    
        res.status(200).json({ success: true, message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully.` });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating the user status' });
    }
};





module.exports = {
    userInfo,
    toggleBlockStatus
};
