const fs = require('fs');
const path = require('path');

exports.deleteFile = (filePath) => {
    if (!filePath) return;
    
    // Resolve the full path
    const fullPath = path.join(__dirname, '../../public', filePath);

    fs.unlink(fullPath, (err) => {
        if (err) {
            console.error(`Failed to delete file: ${fullPath}`, err);
        } else {
            console.log(`Garbage Collector: File deleted: ${fullPath}`);
        }
    });
};