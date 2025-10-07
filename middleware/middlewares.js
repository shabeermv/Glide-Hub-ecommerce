const User = require("../models/userSchema");

function authMiddleware(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect("/login");
  }
}

function signMiddleware(req, res, next) {
  if (req.session.userId) {
    res.redirect("/");
  } else {
    next();
  }
}
async function distroyByBlocking(req, res, next) {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      console.log(user, "user found");
      if (user && user.isBlocked) {
        req.session.destroy(() => {
          return res.redirect("/login");
        });
      } else {
        next();
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      next(error);
    }
  } else {
    next();
  }
}

const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    return next();
  } else {
    return res.redirect("/admin/adminLogin");
  }
};

module.exports = {
  authMiddleware,
  signMiddleware,
  distroyByBlocking,
  adminAuth,
};
