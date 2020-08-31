const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");

//creating jwt token with .sign() for logging user in
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 3600 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  // hide the password from output
  user.password = undefined;

  //SEND COOKIE
  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

//SIGN UP a USER
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  //creating a token & send it to user
  createSendToken(newUser, 201, res);
});

//LOG IN a USER
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  //1) if email & password exists
  if (!email || !password) {
    return next(new AppError("Please provide email & password!", 400));
  }

  //2) if user exists & pasword matches
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password!", 400));
  }

  //3) if all ok, send token to client
  createSendToken(user, 200, res);
});

//protect routes
exports.protect = catchAsync(async (req, res, next) => {
  // 1) get the token & check of it's there...
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new AppError("You are not logged in! please log in to get access", 401)
    );
  }
  // 2) verification token...
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) check if user still exists...
  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError("The user belonging to the token does not exist", 401)
    );
  }

  // 4) check if user changed password after the token was issued...
  if (currentUser.passwordChangedAfter(decoded.iat)) {
    return next(
      new AppError(
        "User has recently changed password! please login again.",
        401
      )
    );
  }

  req.user = currentUser;
  //GRANT USER TO PROTECTED ROUTE
  next();
});
