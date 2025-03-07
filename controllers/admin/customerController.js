const User = require('../../models/userSchema');

const userInfo = async (req, res) => {
    try {
        const search = req.query.search || ''; 
        
        const page = parseInt(req.query.page) || 1; 
        
        const limit = 6; 

        const validPage = Math.max(page, 1);

        const searchQuery = new RegExp(search, 'i');

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: searchQuery } }, 
                { email: { $regex: searchQuery } }  
            ]
        })
        .limit(limit)
        .skip((validPage - 1) * limit)
        .exec();

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
        next(error)    }
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
        next(error)    }
};





module.exports = {
    userInfo,
    toggleBlockStatus
};
