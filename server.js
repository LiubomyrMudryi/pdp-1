const express = require('express')
const mongoose = require('mongoose')
const app = express()
const Product = require('./models/product')
const User = require('./models/user')
const Order = require('./models/order')
const Chance = require('chance');

const chance = new Chance();
app.use(express.json());

const generateUserData = () => ({
    firstName: chance.first(),
    lastName: chance.last(),
    email: chance.email(),
});

const generateProductData = () => ({
    name: chance.word(),
    quantity: chance.integer({ min: 1, max: 100 }),
    price: chance.floating({ min: 1, max: 1000, fixed: 2 }),
    image: chance.url(),
});


// Fill data
app.get('/add-initial-data', async (req, res) => {
    try {
        const usersData = Array.from({ length: 10 }, generateUserData);
        await User.insertMany(usersData);

        const productsData = Array.from({ length: 10 }, generateProductData);
        await Product.insertMany(productsData);

        res.status(200).json({ message: 'Початкові дані успішно додані.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при додаванні початкових даних.' });
    }
})
app.post('/create-order', async (req, res) => {
    try {
        console.log(req.body);
        const { userId, productId } = req.body;

        const userExists = await User.findById(userId);
        const productExists = await Product.findById(productId);

        if (!userExists) {
            return res.status(400).json({ message: 'Користувач не знайдено.' });
        }
        if (!productExists) {
            return res.status(400).json({ message: 'Продукт не знайдено.' });
        }

        const newOrder = new Order({
            createdAt: new Date(),
            userId: userId,
            productId: productId,
        });

        await newOrder.save();

        res.status(201).json({ message: 'Замовлення успішно створено.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при створенні замовлення.' });
    }
});

// Products CRUD
app.post('/products', async (req, res) => {
    try {
        const { name, quantity, price, image } = req.body;

        const newProduct = new Product({
            name,
            quantity,
            price,
            image,
        });

        const savedProduct = await newProduct.save();

        res.status(201).json(savedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при створенні продукту.' });
    }
});
app.get('/products-list', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при отриманні списку продуктів.' });
    }
});
app.put('/products/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;
        const { name, quantity, price, image } = req.body;

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { name, quantity, price, image },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Продукт не знайдено.' });
        }

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при оновленні продукту.' });
    }
});
app.delete('/products/:productId', async (req, res) => {
    try {
        const productId = req.params.productId;

        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Продукт не знайдено.' });
        }

        res.status(200).json(deletedProduct);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при видаленні продукту.' });
    }
});

// Aggregation (sort, skip, limit)
app.get('/products', async (req, res) => {
    try {
        const { sort, limit, skip, search } = req.query;
        const aggregationPipeline = [];

        if (search) {
            aggregationPipeline.push({
                $match: {
                    name: { $regex: new RegExp(search, 'i') },
                },
            });
        }

        const sortField = sort || 'name';
        aggregationPipeline.push({
            $sort: {
                [sortField]: 1,
            },
        });

        const skipValue = parseInt(skip) || 0;
        const limitValue = parseInt(limit) || 10;
        aggregationPipeline.push(
            { $skip: skipValue },
            { $limit: limitValue }
        );

        const products = await Product.aggregate(aggregationPipeline);

        res.status(200).json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при отриманні списку продуктів.' });
    }
});

// Aggregate functions of MongoDB: avg, sum, min, max, first, push addToSet, last ( + Projection)
app.get('/products-statistic', async (req, res) => {
    try {
        const aggregationPipeline = [
            {
                $group: {
                    _id: null,
                    avgPrice: { $avg: '$price' },
                    totalPrice: { $sum: '$price' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' },
                    uniqueNames: { $addToSet: '$name' },
                    firstProduct: { $first: '$$ROOT' },
                    lastProduct: { $last: '$$ROOT' },
                },
            },
            {
                $project: {
                    _id: 0,
                    avgPrice: 1,
                    totalPrice: 1,
                    minPrice: 1,
                    maxPrice: 1,
                    uniqueNames: 1,
                    firstProductName: '$firstProduct.name',
                    lastProductName: '$lastProduct.name',
                },
            },
        ];

        const result = await Product.aggregate(aggregationPipeline);

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при виконанні агрегаційного запиту.' });
    }
});

// Join operations in MongoDB + Projection
app.get('/order-details/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const result = await Order.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(orderId),
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userDetails',
                },
            },
            {
                $unwind: '$userDetails',
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            {
                $unwind: '$productDetails',
            },
            {
                $project: {
                    'userDetails.password': 0,
                },
            },
        ]);

        if (!result || result.length === 0) {
            return res.status(404).json({ message: 'Замовлення не знайдено.' });
        }

        res.status(200).json(result[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Помилка при отриманні даних замовлення.' });
    }
});

mongoose.set("strictQuery", false)
mongoose.
connect('mongodb+srv://liubomyr:password1!@cluster0.7kfnuui.mongodb.net/?retryWrites=true&w=majority')
    .then(() => {
        console.log('connected to MongoDB')
        // Order.collection.createIndex({ userId: 1 });
        // Order.collection.createIndex({ productId: 1 });
        app.listen(3000, ()=> {
            console.log(`Node API app is running on port 3000`)
        });
    }).catch((error) => {
    console.log(error)
})
