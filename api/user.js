const express = require('express');
const router = express.Router();

// mongodb user model
const User = require('../models/userModel');

// mongodb user verification model
const UserVerification = require('./../models/UserVerification');

// mongodb password reset model
const PasswordReset = require('./../models/PasswordReset');

// email handler
const nodemailer = require('nodemailer');

// unique string
const { v4: uuidv4 } = require('uuid');

// env variables
require('dotenv').config();

// Password handler
const bcrypt = require('bcrypt');

//path for static verified page
const path = require('path');

// nodemailer
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

// testing success
transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log('Ready for messages');
    console.log(success);
  }
});

// Signup
router.post('/signup', (req, res) => {
  let { name, email, password, dateOfBirth } = req.body;
  name = name.trim();
  email = email.trim();
  password = password.trim();
  dateOfBirth = dateOfBirth.trim();

  if (name == '' || email == '' || password == '' || dateOfBirth == '') {
    res.json({
      status: 'FAILED',
      message: 'Empty input fields!',
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    res.json({
      status: 'FAILED',
      message: 'Invalid name entered',
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    res.json({
      status: 'FAILED',
      message: 'Invalid email entered',
    });
  } else if (!new Date(dateOfBirth).getTime()) {
    res.json({
      status: 'FAILED',
      message: 'Invalid date of birth entered',
    });
  } else if (password.length < 8) {
    res.json({
      status: 'FAILED',
      message: 'Password is too short!',
    });
  } else {
    // Checking if user already exists
    User.find({ email })
      .then((result) => {
        if (result.length) {
          // A user already exists
          res.json({
            status: 'FAILED',
            message: 'User with the provided email already exists!',
          });
        } else {
          // Try to create new user

          // passowrd handling
          const saltRounds = 10;
          bcrypt
            .hash(password, saltRounds)
            .then((hashedPassword) => {
              const newUser = new User({
                name,
                email,
                password: hashedPassword,
                dateOfBirth,
                verified: false,
              });

              newUser
                .save()
                .then((result) => {
                  // handle account verification
                  sendVerificationEmail(result, res);
                })
                .catch((err) => {
                  res.json({
                    status: 'FAILED',
                    message: 'An error occured while saving user account!',
                  });
                });
            })
            .catch((err) => {
              res.json({
                status: 'FAILED',
                message: 'An error occured while hashing password!',
              });
            });
        }
      })
      .catch((err) => {
        console.log(err);
        res.json({
          status: 'FAILED',
          message: 'An error occured while checking for existing users!',
        });
      });
  }
});

// send verification email
const sendVerificationEmail = ({ _id, email }, res) => {
  // url to be used in the email
  const currentUrl = 'http://localhost:5000/';

  const uniqueString = uuidv4() + _id;

  // mail options
  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: 'Verify Your Email',
    html: `<p>Verify your email to complete the signup and login into your account.<p>This link<b>expires in 6 hours</b>.</p></p><p>Press <a href=${
      currentUrl + 'user/verify/' + _id + '/' + uniqueString
    }>here</a> to proceed.</p>`,
  };

  // hash the uniqueString
  const saltRounds = 10;
  bcrypt
    .hash(uniqueString, saltRounds)
    .then((hashedUniqueString) => {
      // set values in userVerification collection
      const newVerification = new UserVerification({
        userId: _id,
        uniqueString: hashedUniqueString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 21600000,
      });

      newVerification
        .save()
        .then(() => {
          transporter
            .sendMail(mailOptions)
            .then(() => {
              // email sent and verification record saved
              res.json({
                status: 'PENDING',
                message: 'Verification email sent',
              });
            })
            .catch((error) => {
              console.log(error);
              res.json({
                status: 'FAILED',
                message: 'Verification email failed!',
              });
            });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: 'FAILED',
            message: "Couldn't save verification email data!",
          });
        });
    })
    .catch(() => {
      res.json({
        status: 'FAILED',
        message: 'An error occured while hashing email data!',
      });
    });
};

// verify email
router.get('/verify/:userId/:uniqueString', (req, res) => {
  let { userId, uniqueString } = req.params;

  UserVerification.find({ userId })
    .then()
    .catch((error) => {
      console.log(error);
    });
});

// Signin
router.post('/signin', (req, res) => {
  let { email, password } = req.body;
  email = email.trim();
  password = password.trim();

  if (email == '' || password == '') {
    res.json({
      status: 'FAILED',
      message: 'Empty credentials supplied!',
    });
  } else {
    // Check if user exists
    User.find({ email })
      .then((data) => {
        if (data.length) {
          // User exists

          const hashedPassword = data[0].password;
          bcrypt
            .compare(password, hashedPassword)
            .then((result) => {
              if (result) {
                // Password matches
                res.json({
                  status: 'SUCCESS',
                  message: 'Signin successful!',
                  data: data,
                });
              } else {
                res.json({
                  status: 'FAILED',
                  message: 'Invalid password entered!',
                });
              }
            })
            .catch((err) => {
              res.json({
                status: 'FAILED',
                message: 'An error occured while comparing passwords!',
              });
            });
        } else {
          res.json({
            status: 'FAILED',
            message: 'Invalid credentials entered!',
          });
        }
      })
      .catch((err) => {
        res.json({
          status: 'FAILED',
          message: 'An error occured while checking for existing users!',
        });
      });
  }
});

// Password reset
router.post('/requestPasswordReset', (req, res) => {
  const { email, redirectUrl } = req.body;

  //check if email exists
  User.find({ email })
    .then((data) => {
      if (data.length) {
        // user exists

        // check if user is verified

        if (!data[0].verified) {
          res.json({
            status: 'FAILED',
            message: "Email hasn't been verified yet. Check your inbox",
          });
        } else {
          // proceed with email to reset password
          sendResetEmail(data[0], redirectUrl, res);
        }
      } else {
        res.json({
          status: 'FAILED',
          message: 'No account with the supplied email exists!',
        });
      }
    })
    .catch((error) => {
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'An error occured while checking for existing users!',
      });
    });
});

// send password reset email
const sendResetEmail = ({ _id, email }, redirectUrl, res) => {
  const resetString = uuidv4 + _id;

  PasswordReset.deleteMany({ userId: _id })
    .then((result) => {
      // Reset records successfully
      const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: email,
        subject: 'Password Reset',
        html: `<p>Use the link below to reset your password.</p><p>This link <b>expires in 60 minutes</b>.</p><p>Press <a href=${
          redirectUrl + '/' + _id + '/' + resetString
        }>here</a> to proceed.</p>`,
      };

      // hash the reset string
      const saltRounds = 10;
      bcrypt
        .hash(resetString, saltRounds)
        .then((hashedResetString) => {
          // set values in password reset collection
          const newPasswordReset = new PasswordReset({
            userId: _id,
            resetString: hashedResetString,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600000,
          });

          newPasswordReset
            .save()
            .then(() => {
              transporter
                .sendMail(mailOptions)
                .then(() => {
                  // reset email sent and reser record saved
                  res.json({
                    status: 'PENDING',
                    message: 'Password reset email sent',
                  });
                })
                .catch((error) => {
                  console.log(error);
                  res.json({
                    status: 'FAILED',
                    message: 'Password reset email failed!',
                  });
                });
            })
            .catch((error) => {
              console.log(error);
              res.json({
                status: 'FAILED',
                message: "Couldn't save password reset data!",
              });
            });
        })
        .catch((error) => {
          console.log(error);
          res.json({
            status: 'FAILED',
            message: 'An error occured while hashing the password reset data!',
          });
        });
    })
    .catch((error) => {
      // error when clearing existing records
      console.log(error);
      res.json({
        status: 'FAILED',
        message: 'Clearing existing password reset records failed',
      });
    });
};

module.exports = router;
