const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const dotenv = require('dotenv');
dotenv.config();

const createRoot = async () => {
    await mongoose.connect(process.env.DATABASE_URL);
    
    const rootExists = await Admin.findOne({ email: process.env.ROOT_ADMIN_EMAIL });
    if (rootExists) {
        console.log("Root admin already exists, Sir.");
    } else {
        await Admin.create({
            name: "The Owner",
            email: process.env.ROOT_ADMIN_EMAIL,
            password: "ASuperSecurePassword123!", // CHANGE THIS IMMEDIATELY
            employeeId: "ROOT-001"
        });
        console.log("Root Admin created. The vault is recovered.");
    }
    process.exit();
};

createRoot();