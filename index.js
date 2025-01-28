require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.j5p3s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const userCollection = client.db("MediEaseDB").collection("users");
    const medicineCollection = client.db("MediEaseDB").collection("medicines");
    const categoryCollection = client.db("MediEaseDB").collection("categories");
    const cartCollection = client.db("MediEaseDB").collection("carts");
    const paymentCollection = client.db("MediEaseDB").collection("payments");
    const advertisementCollection = client.db("MediEaseDB").collection("advertisements");


    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '12h' });
      res.send({ token })
    })

    // verifyToken middleware
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
      })
    }

    // verifyAdmin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role == 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // verifySeller after verifyToken
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isSeller = user?.role == 'seller';
      if (!isSeller) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    // users related api (verifyToken, verifyAdmin,)
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // check isAdmin api (verifyToken,)
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    })

    // check isSeller api (verifyToken,)
    app.get('/users/seller/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let seller = false;

      if (user) {
        seller = user?.role == 'seller';
      }

      res.send({ seller })
    })


    // insert user in database
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'User already exist', insertedId: null })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // (user delete) not in requirements (verifyToken, verifyAdmin,)
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    // make admin (verifyAdmin) (verifyToken, verifyAdmin,)
    app.patch('/users/admin/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // make seller (verifySeller) (verifyToken, verifyAdmin,)
    app.patch('/users/seller/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'seller'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // make user (verifyUser) (verifyToken, verifyAdmin,)
    app.patch('/users/user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'user'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // all medicine api (in shop tab)
    app.get('/medicines', async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    })

    // insert medicines in database (verifyToken, verifySeller,)
    app.post('/medicines', verifyToken, verifySeller, async (req, res) => {
      const medicine = req.body;
      const result = await medicineCollection.insertOne(medicine);
      res.send(result);
    })

    // advertise api(verifyToken)
    app.get('/advertisements', verifyToken, async (req, res) => {
      const result = await advertisementCollection.find().toArray();
      res.send(result);
    })

    app.get('/activeAdvertisements', async (req, res) => {
      const query = { status: "active" }
      const result = await advertisementCollection.find(query).toArray();
      res.send(result);
    })

    // (verifyToken, verifySeller,)
    app.post('/advertisements', verifyToken, verifySeller, async (req, res) => {
      const advertise = req.body;
      const result = await advertisementCollection.insertOne(advertise);
      res.send(result);
    })

    // verifyToken, verifyAdmin,
    app.patch('/advertisements/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      statusActiveDoc = {
        $set: { status: req?.body?.status }
      }
      const result = await advertisementCollection.updateOne(filter, statusActiveDoc);
      res.send(result);
    })

    // discount medicine api
    app.get('/discounted_medicines', async (req, res) => {
      const result = await medicineCollection.aggregate([
        {
          $match: {
            discount_percentage: { $gt: 0 },
          },
        },
        {
          $project: {
            _id: 0,
            name: 1,
            discounted_medicines: 1,
            discount_percentage: 1,
            image: 1,
          },
        },
      ]).toArray();

      res.send(result);
    });


    // category medicine in home page
    app.get('/categories', async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    })

    // get specific category api
    app.get('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.findOne(query);
      res.send(result);
    })

    // update specific category api (verifyToken, verifyAdmin,)
    app.patch('/categories/:id', verifyToken, verifyAdmin, async (req, res) => {
      const specificCategory = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updatedDoc = {
        $set: {
          category: specificCategory.category,
          image: specificCategory.image
        }
      }

      const result = await categoryCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // insert category in database (verifyToken, verifyAdmin,)
    app.post('/categories', verifyToken, verifyAdmin, async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    })

    // delete specific category api (verifyToken, verifyAdmin,) 
    app.delete('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    })



    // carts collection api
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    // insert cart product in database
    app.post('/carts', async (req, res) => {
      const cartMedicine = req.body;
      const result = await cartCollection.insertOne(cartMedicine);
      res.send(result);
    })

    // delete cart medicine api
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // clear all cart by logged user
    app.delete('/carts/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await cartCollection.deleteMany(query);
      res.send(result)
    })

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      // console.log(amount, 'Amount inside the intent');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment related api
    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    })

    // (verifyToken,)
    app.get('/payments/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email };
      const result = await paymentCollection.find(query).toArray();

      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      res.send(result);
    })

    // get paid payment after pay to invoice page
    app.get('/payments/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.findOne(query, getInvoice);
      res.send(result);
    })

    // post a payment after successful payment (not used)
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      // console.log('Payment info', payment);
      const query = {
        _id: {
          $in: payment.cartIds.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({ paymentResult, deleteResult });
    })

    // update payment status verifyAdmin,
    app.patch('/payments/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedStatus = {
        $set: {
          status: 'paid'
        }
      }
      const result = await paymentCollection.updateOne(filter, updatedStatus);
      res.send(result);
    })


    // seller homepage (stats)  (verifyToken, verifySeller,)
    app.get('/seller-stats', verifyToken, verifySeller, async (req, res) => {

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$price"
            },
          },
        }
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      const pendingResult = await paymentCollection.aggregate([
        {
          $match: { status: "pending" }
        },
        {
          $count: "totalPending"
        }
      ]).toArray();
      const pendingStatus = pendingResult.length > 0 ? pendingResult[0].totalPending : 0;

      const paidResult = await paymentCollection.aggregate([
        {
          $match: { status: "paid" }
        },
        {
          $count: "totalPaid"
        }
      ]).toArray();
      const paidStatus = paidResult.length > 0 ? paidResult[0].totalPaid : 0;

      res.send({
        revenue,
        pendingStatus,
        paidStatus
      })
    })
    // admin homepage (stats) (verifyToken, verifyAdmin,)
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$price"
            }
          }
        }
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      const pendingResult = await paymentCollection.aggregate([
        {
          $match: { status: "pending" }
        },
        {
          $count: "totalPending"
        }
      ]).toArray();
      const pendingStatus = pendingResult.length > 0 ? pendingResult[0].totalPending : 0;

      const paidResult = await paymentCollection.aggregate([
        {
          $match: { status: "paid" }
        },
        {
          $count: "totalPaid"
        }
      ]).toArray();
      const paidStatus = paidResult.length > 0 ? paidResult[0].totalPaid : 0;

      res.send({
        revenue,
        pendingStatus,
        paidStatus
      })
    })

    // sales reports  (verifyToken, verifyAdmin,)
    app.get("/sellsInfo", verifyToken, verifyAdmin, async (req, res) => {
      const paymentsData = await paymentCollection.aggregate([
        {
          $lookup: {
            from: "medicines",
            localField: "medicineItemIds",
            foreignField: "_id",
            as: "salesDetails",
          },
        },
        {
          $unwind: "$salesDetails",
        },
        {
          $project: {
            _id: 0,
            buyerEmail: "$email",
            medicineName: "$salesDetails.name",
            price: "$price",
            unit_price: '$unit_price',
            sellerEmail: "$salesDetails.seller_email",
          },
        },
      ]).toArray();
      res.send(paymentsData)
    })

    // payment stats  (verifyToken, verifyAdmin,)
    app.get('/payment-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$medicineItemIds'
        },
        {
          $lookup: {
            from: 'medicines',
            localField: 'medicineItemIds',
            foreignField: '_id',
            as: 'medicineItems'
          }
        },
        {
          $unwind: '$medicineItems'
        },
        {
          $group: {
            _id: '$medicineItems.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$medicineItems.unit_price' }
          }
        }, {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('MediEase is waiting for you')
})

app.listen(port, () => {
  console.log(`MediEase is waiting for you on port ${port}`);
})