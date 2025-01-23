const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
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
    await client.connect();

    const userCollection = client.db("MediEaseDB").collection("users");
    const medicineCollection = client.db("MediEaseDB").collection("medicines");
    const categoryCollection = client.db("MediEaseDB").collection("categories");
    const cartCollection = client.db("MediEaseDB").collection("carts");

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '6h' });
      res.send({ token })
    })

    // verifyToken middleware
    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
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
    // const verifySeller = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const user = await userCollection.findOne(query);
    //   const isSeller = user?.role == 'seller';
    //   if (!isSeller) {
    //     return res.status(403).send({ message: 'forbidden access' });
    //   }
    //   next();
    // }

    // all medicine api (in shop tab)
    app.get('/medicines', async (req, res) => {
      const result = await medicineCollection.find().toArray();
      res.send(result);
    })

    // insert medicines in database
    app.post('/medicines', async (req, res) => {
      const medicine = req.body;
      const result = await medicineCollection.insertOne(medicine);
      res.send(result);
    })



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

    // update specific category api
    app.patch('/categories/:id', async (req, res) => {
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

    // insert category in database
    app.post('/categories', async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    })

    // delete specific category api
    app.delete('/categories/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await categoryCollection.deleteOne(query);
      res.send(result);
    })



    // users related api
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    // check isAdmin api
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

    // check isSeller api
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
      // insert email if user doesn't exist(many ways: 1. email unique, 2. upsert , 3. simple checking)
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exist', insertedId: null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // (user delete) not in requirements (verifyAdmin)
    app.delete('/users/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result)
    })

    // make admin (verifyAdmin)
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

    // make seller (verifySeller)
    app.patch('/users/seller/:id', verifyToken, async (req, res) => {
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

    // make user (verifyUser)
    app.patch('/users/user/:id', verifyToken, async (req, res) => {
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

    // role update api
    //   app.patch('/users/role/:id', verifyToken, verifyAdmin, async (req, res) => {
    //     const id = req.params.id;
    //     const { role } = req.body; // Extract role from request body

    //     if (!['admin', 'seller', 'user'].includes(role)) {
    //         return res.status(400).send({ error: 'Invalid role. Allowed roles are admin and seller.' });
    //     }

    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = {
    //         $set: { role: role }
    //     };

    //     const result = await userCollection.updateOne(filter, updatedDoc);
    //     res.send(result);
    // });


    // app.patch('/users/role/:id', verifyToken, async (req, res) => {
    //   try {
    //     const id = req.params.id;
    //     const { role } = req.body; // Extract the role from the request body

    //     if (!role || !['admin', 'seller', 'user'].includes(role)) {
    //       return res.status(400).send({ error: 'Invalid role specified.' });
    //     }

    //     const filter = { _id: new ObjectId(id) };
    //     const updatedDoc = {
    //       $set: {
    //         role: role
    //       }
    //     };

    //     const result = await userCollection.updateOne(filter, updatedDoc);

    //     if (result.modifiedCount === 0) {
    //       return res.status(404).send({ error: 'User not found or role unchanged.' });
    //     }

    //     res.send({ message: 'Role updated successfully.', result });
    //   } catch (error) {
    //     console.error('Error updating role:', error);
    //     res.status(500).send({ error: 'Internal Server Error' });
    //   }
    // });


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

    // Todo: delete all carts medicine

    // app.delete('/carts/:email', async (req, res) => {
    //   const query = {email: req.params.email}
    //   const result = await cartCollection.find(query).deleteMany({});
    //   res.send(result);
    // })

    // app.delete('/carts', async (req, res) => {
    //   const email = req.query.email;
    //   const query = { email: email };
    //   const result = await cartCollection.find(query).deleteMany({});
    //   res.send(result);
    // })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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