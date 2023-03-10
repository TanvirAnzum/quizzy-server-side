/**
 * title: Server side portion of quizzy project
 * description: a rest ful api for creating,fetching,deleting and updating quizzes.
 * author: Tanvir Anzum
 * Date: 30-10-2022
 */

// dependencies
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { request, application } = require("express");
const { ObjectID } = require("bson");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// express initialization
const app = express();
const port = 9000;

// middlewares
app.use(cors());
app.use(express.json());

// mongodb initialization
const uri =
  "mongodb+srv://dbuser:Ez2TFV69oE72lwNN@cluster0.ote0m1f.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// query homepages
app.get("/", (req, res) => {
  res.send("Welcome to the server side of quizzy application.");
});

// middleware function to verify jwt token

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({
      message: "unauthorized access",
    });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

// functions to connect with db

async function run() {
  try {
    const db = client.db("quizzesDB").collection("quizzes");
    const testsCollection = client.db("quizzesDB").collection("tests");

    /// jwt token request
    app.post("/jwt", (req, res) => {
      const data = req.body;
      const token = jwt.sign(data, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });

      res.send({ token });
    });

    //get requests

    app.get("/quizzes", verifyJWT, async (req, res) => {
      const userEmail = req.query.email;
      const limit = Number(req.query.limit);
      const page = Number(req.query.page);
      const status = req.query.status;

      const { email } = req.decoded || {};

      if (email !== userEmail) {
        res.status(403).send({ message: "unauthorized access" });
      } else {
        const query = {
          author: userEmail,
        };
        if (status === "pending" || status === "published")
          query.status = status;

        const totalItems = await db.countDocuments(query);

        const cursor = db
          .find(query)
          .skip(page ? (limit ? page * limit : 0) : 0)
          .limit(limit ? limit : 10);
        const result = await cursor.toArray();

        res.send({
          quizzes: result,
          totalCount: totalItems,
        });
      }
    });

    // for getting partcipated quizzes

    app.get("/quizzes/:email", async (req, res) => {
      const userEmail = req.params.email;
      const limit = Number(req.query.limit);
      const page = Number(req.query.page);

      const query = {
        participants: { $in: [userEmail] },
      };

      const particaptedQuizCursor = db
        .find(query)
        .skip(page ? (limit ? page * limit : 0) : 0)
        .limit(limit ? limit : 10);

      const totalParticipatedQuiz = await db.countDocuments(query);
      const participatedQuiz = await particaptedQuizCursor.toArray();

      res.send({
        quizzes: participatedQuiz,
        totalCount: totalParticipatedQuiz,
      });
    });

    app.get("/quiz/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const result = await db.findOne(query);
      res.send(result);
    });

    // post request

    app.post("/quiz", async (req, res) => {
      const data = req.body;
      const result = await db.insertOne(data);
      res.send(data);
    });

    // patch request

    app.patch("/quiz/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const updatedData = req.body;
      const options = { upsert: true };

      if (updatedData.contents) {
        const updateData = {
          $push: {
            contents: updatedData.contents,
          },
        };
        const result = await db.updateOne(query, updateData, options);
        res.send(result);
      } else if (updatedData.participants) {
        const updateData = {
          $push: {
            participants: updatedData.participants,
          },
        };
        const result = await db.updateOne(query, updateData, options);
        res.send(result);
      } else {
        const updateData = {
          $set: {
            ...updatedData,
          },
        };
        const result = await db.updateOne(query, updateData, options);
        res.send(result);
      }
    });

    // delete request

    app.delete("/quiz/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectID(id) };
      const result = await db.deleteOne(query);
      res.send(result);
    });

    // create new test
    app.post("/test", async (req, res) => {
      const data = req.body;
      const email = req.query.email;
      const quizId = req.query.quizId;
      const response = await testsCollection.findOne({ quizId, email });
      console.log(response);
      if (response?._id) {
        res.status(403).send({ message: "This user already given the test" });
      } else {
        const result = await testsCollection.insertOne(data);
        res.send(data);
      }
    });

    // get test
    app.get("/test", async (req, res) => {
      const testId = req.query.id;
      const email = req.query.email;
      console.log(testId);

      const query = {};
      if (testId) {
        query._id = ObjectID(testId);
        const response = await testsCollection.findOne(query);
        res.send(response);
      }
      if (email) {
        query.email = email;
        const cursor = testsCollection.find(query);
        const response = await cursor.toArray();
        res.send(response);
      }
    });

    // update test
    app.patch("/test/:id", async (req, res) => {
      const testId = req.params.id;
      const question = req.query.question;
      let updatedData = { ...req.body };

      if (question >= 0) {
        updatedData[`contents.${question}.answered`] = true;
      }

      const updateOpt = await testsCollection.updateOne(
        { _id: ObjectID(testId) },
        {
          $set: {
            ...updatedData,
          },
        },
        { upsert: true }
      );

      res.send(updateOpt);
    });
  } catch (error) {
    console.log(error);
  }
}

run();

app.listen(port, () => {
  console.log("Server is listening on port " + port);
});
