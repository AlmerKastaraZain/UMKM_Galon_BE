const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // The 'strictQuery' warning is common in Mongoose 7+, this fixes it
        mongoose.set('strictQuery', false);

        const conn = await mongoose.connect(process.env.DATABASE_URL);
        
        console.log(`--- MongoDB Connected: ${conn.connection.host} ---`);
        console.log(`--- Database Name: ${conn.connection.name} ---`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        // If DB fails, the app is useless. Kill it.
        process.exit(1); 
    }
};

module.exports = connectDB;