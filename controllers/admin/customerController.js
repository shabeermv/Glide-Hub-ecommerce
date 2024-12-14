const User = require('../../models/userSchema');

const userInfo = async (req, res) => {
    try {
        const search = req.query.search || ''; 
        const page = parseInt(req.query.page) || 1; 
        const limit = 6;

        const validPage = Math.max(page, 1);

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } }, 
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        })
        .limit(limit)
        .skip((validPage - 1) * limit)
        .exec();

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } }
            ]
        });

        const totalPages = Math.ceil(count / limit);

        res.render('users', {
            data: userData,
            currentPage: validPage,
            totalPages: totalPages,
            search: search,
        });
    } catch (error) {
        console.error('Error in userInfo:', error);
        res.status(500).send('An error occurred while fetching user data');
    }
};

const blockUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndUpdate(userId, { isBlocked: true }, { new: true });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User blocked', user });
    } catch (error) {
        console.error('Internal error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const unBlockUser = async (req, res) => {
    
    try {
        const userId = req.params.id;
        const user = await User.findByIdAndUpdate(userId, { isBlocked: false }, { new: true });
  
  
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ message: 'User unblocked', user });
    } catch (error) {
        console.error('Unblocking error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    userInfo,
    blockUser,
    unBlockUser
};
