const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String },
    price: { type: Number, required: true, min: 0 },
    
    images: [{
        url: { type: String, required: true },
        public_id: { type: String }
    }],

    category: { 
        type: String, 
        enum: ['19L_Gallon', '5L_Bottle', 'Small_Bottle', 'Accessories'],
        default: '19L_Gallon'
    },

    productType: { 
        type: String, 
        enum: ['REFILL', 'NEW_BOTTLE', 'LOAN'], 
        required: true 
    },

    inventory: {
        stock: { type: Number, required: true, default: 0 },
        isAvailable: { type: Boolean, default: true }
    },

    // Metadata
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    
    metadata: {
        totalSold: { type: Number, default: 0 },
        viewCount: { type: Number, default: 0 },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }
    }
}, { timestamps: true });

// GLOBAL FILTER: Hides deleted items unless we explicitly ask for them
productSchema.pre(/^find/, function(next) {
    if (this.getFilter().includeDeleted !== true) {
        this.find({ isDeleted: false });
    }
    next();
});

module.exports = mongoose.model('Product', productSchema);