const mongoose = require('mongoose')

const orderSchema = mongoose.Schema(
    {
        createdAt: {
            type: Date,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
    },
    {
        timestamps: true
    }
)


const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
