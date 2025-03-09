const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

// console.log('Database URI:', process.env.DATABASE);

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(DB).then(() => console.log('DB connection successful!'));

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// //mongodb
// require('./config/db');

// const app = require('express')();
// const port = process.env.PORT || 5000;

// // cors
// // const cors = require('cors');
// // app.use(cors);

// const UserRouter = require('./routes/userRoutes');

// // For accepting post form data
// const bodyParser = require('express').json;
// app.use(bodyParser());

// app.use('/userRoutes', UserRouter);

// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });
