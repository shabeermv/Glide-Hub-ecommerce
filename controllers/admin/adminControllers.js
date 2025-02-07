const User = require('../../models/userSchema');
const bcrypt = require('bcrypt');

const adminLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.render('adminPanel');
        }
        res.render('adminLogin');
    } catch (error) {
        console.log(error.message);
    }
};

const getHome = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.render('adminPanel');
        }
        res.render('adminLogin');
    } catch (error) {
        console.log(error.message);
    }
};

const postAdmin = async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);
    

    try {
        // Check if the admin user exists and has isAdmin: true
        const adminUser = await User.findOne({ email, isAdmin: true });
        console.log(adminUser,'l00000000000000000000000000');
        
        if (!adminUser) {
            return res.status(404).json({ success: false, message: "Admin not found or unauthorized" });
        }

        // Validate the password
        const isPasswordValid = await bcrypt.compare(password, adminUser.password);
        console.log('Password validation:', isPasswordValid);

        if (!isPasswordValid) {
            console.log('password mathch alla');
            return res.status(401).json({ success: false, message: "Invalid email or password" });
            
            
        }

        // Set admin session
        req.session.admin = adminUser._id;

        // Send success response
        return res.status(200).json({ success: true, message: "Login successful" });

    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const logoutAdmin = (req, res) => {
    // Check if the logged-in user is an admin
    if (req.session.user && req.session.user.isAdmin) {
      console.log("Admin is logging out");
  
      // Perform admin-specific logout actions here if needed (e.g., logging activity)
    }
  
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Could not log out" });
      }
      res.clearCookie("connect.sid"); // Clear the session cookie
      res.render("adminLogin"); // Redirect to login page after logout
    });
  };
  

module.exports = {
    adminLogin,
    postAdmin,
    getHome,
    logoutAdmin
};
