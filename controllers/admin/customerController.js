const User = require("../../models/userSchema");
const statusCode = require("../../utils/statusCodes")

const userInfo = async (req, res, next) => {
  try {
    const searchValue = req.query.search || "";  
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const validPage = Math.max(page, 1);

    let query = { isAdmin: false };
    if (searchValue) {
      const searchQuery = new RegExp(searchValue, "i");
      query.$or = [
        { username: { $regex: searchQuery } },
        { email: { $regex: searchQuery } },
      ];

      
      if (!isNaN(searchValue)) {
        query.$or.push({ contact: Number(searchValue) });
      }
    }

    const userData = await User.find(query)
      .limit(limit)
      .skip((validPage - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);
    const totalPages = Math.ceil(count / limit);

    res.render("users", {
      data: userData,
      currentPage: validPage,
      totalPages,
      searchValue, 
    });
  } catch (error) {
    console.error("Error in userInfo:", error);
    next(error); // goes to error middleware
  }
};


const toggleBlockStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throw new Error("user not found...");
    }

    user.isBlocked = isBlocked;

    await user.save();

    res
      .status(statusCode.OK)
      .json({
        success: true,
        message: `User ${isBlocked ? "blocked" : "unblocked"} successfully.`,
      });
  } catch (error) {
    console.error("Error updating user status:", error);
    next(error);
  }
};

module.exports = {
  userInfo,
  toggleBlockStatus,
};
