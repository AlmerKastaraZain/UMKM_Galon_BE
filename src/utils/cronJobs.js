const Order = require('../models/Order');
const Product = require('../models/Product');
const { logAction } = require('./logger');

exports.cleanZombieStock = async () => {
    try {

        // Find orders PENDING for > 24 hours
        const expirationLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const expiredOrders = await Order.find({
            "status.current": 'PENDING',
            createdAt: { $lt: expirationLimit }
        });

        for (const order of expiredOrders) {
            // Return stock to products
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { "inventory.stock": item.quantity }
                });
            }

            order.status.current = 'CANCELLED';
            order.metadata.cancelReason = 'UNPAID_EXPIRED';
            await order.save();
            
            console.log(`Order ${order._id} cancelled. Stock returned.`);
        }
    } catch (err) {
        console.error("Zombie Stock Error:", err);
    }
};




exports.cleanOrphanFiles = async () => {
    console.log("🧹 Janitor: Starting daily cleanup...");
    try {
        const validFiles = new Set();
        
        // 1. Get valid files from DB
        const products = await Product.find().select('images.url');
        products.forEach(p => p.images.forEach(img => validFiles.add(path.basename(img.url))));

        const orders = await Order.find().select('payment.paymentProofUrl');
        orders.forEach(o => {
            if (o.payment.paymentProofUrl) validFiles.add(path.basename(o.payment.paymentProofUrl));
        });

        const settings = await Settings.findOne();
        if (settings) {
            // Update to check new branding fields
            if (settings.branding.logoUrl) validFiles.add(path.basename(settings.branding.logoUrl));
            if (settings.branding.bannerUrl) validFiles.add(path.basename(settings.branding.bannerUrl));
            if (settings.branding.faviconUrl) validFiles.add(path.basename(settings.branding.faviconUrl));
        }

        // 2. Check the folders from your FOLDER_MAP
        const folders = ['products', 'branding', 'proofs', 'others'];
        
        folders.forEach(folder => {
            const folderPath = path.join(__dirname, `../../public/uploads/${folder}`);
            if (fs.existsSync(folderPath)) {
                const filesOnDisk = fs.readdirSync(folderPath);
                filesOnDisk.forEach(file => {
                    if (file.startsWith('.')) return; 
                    if (!validFiles.has(file)) {
                        fs.unlinkSync(path.join(folderPath, file));
                        console.log(`🗑️ Deleted Orphan: ${folder}/${file}`);
                    }
                });
            }
        });
      } catch (err) {
        console.error("Janitor Failed:", err);
    }
};