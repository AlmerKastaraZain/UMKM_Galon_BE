const dotenv = require('dotenv');
// 1. Load Env Config FIRST before anything else
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { cleanZombieStock, cleanOrphanFiles } = require('./src/utils/cronJobs');

// 2. Connect to Database
connectDB();

// 3. Start Cron Jobs
// Run Zombie Cleaner every hour
setInterval(() => {
    cleanZombieStock();
}, 60 * 60 * 1000);

// Run Janitor every 24 hours
setInterval(() => {
    cleanOrphanFiles();
}, 24 * 60 * 60 * 1000);

// 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`--- Server running on port ${PORT} ---`);
    console.log(`--- Environment: ${process.env.NODE_ENV || 'Development'} ---`);
});