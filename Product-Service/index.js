const express = require('express');
const app = express();
const PORT = process.env.PORT_ONE || 8080;
const mongoose = require('mongoose');
const amqp = require('amqplib')
const Product = require('./models/Product');
const isAuthenticated = require('../Auth-Service/authenticated');
app.use(express.json());


//Useful variables
var connection, channel, order
// const MONGO_URI = "mongodb+srv://sendylo:administrateur@cuisinecluster.xgazwg2.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect("mongodb://localhost:27017/product-service", { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Successfully connected to the database (Product Service)'))
    .catch(() => console.log('Could not connect to the database. Exiting now...'));

/**
* Connects to the rabbitMQ Server and Creates a Queue for PRODUCT 
*/
async function connectRabbitMQ() {
    // Note:- Need to connect rabbitMQ Server, to access the Channel 
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("PRODUCT")
}

connectRabbitMQ()


/**
 * Creates Product with Pre-check of the Authentication
 * @param {name} String Name of the Product 
 * @param {description} String Name of the Product
 * @param {price} Number price of the Product
*/
 app.post("/product/create", isAuthenticated, async (req, res) => {
    try{
     const { name, description, price } = req.body;
     const newProduct = Product({
         name, description, price
     });
     newProduct.save()
     return res.json(newProduct)
     
    }catch(err){
     console.log(err);
    }
 });
 
/**
* //User Sends the list productIds 
* // Create a Order with those products and total of sum of product prices
* @param {Ids} Array Id of the Product/s 
*/
app.post("/product/buy", isAuthenticated, async (req, res) => {
     const { ids } = req.body;
     const products = await Product.find({ _id: { $in: ids } });
     //Sending Products with Details to create the Order to the Queue with Buffer Data
     channel.sendToQueue("ORDER", Buffer.from(JSON.stringify({ products, userEmail: req.user.email })));
     //Consuming Product Channel to get the Acknowledgment of the Order Creation
     channel.consume("PRODUCT", (data) => {
         let receivedOrderAcknowledgment = JSON.parse(data.content)
         console.log('consuming Product',receivedOrderAcknowledgment);
         order = receivedOrderAcknowledgment
         channel.ack(data)
     })
 
     return res.send(order)
 
})

/**
* Listens the server at Provided Port 
*/
app.listen(PORT, () => {
    console.log(`Product-Service at ${PORT}`);
})