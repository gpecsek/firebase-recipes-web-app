const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const FirebaseConfig = require("./FirebaseConfig");
const Utilities = require("./utilities.js");

const auth = FirebaseConfig.auth;
const firestore = FirebaseConfig.firestore;

const app = express();

app.use(cors({ origin: true }));

app.use(bodyParser.json());

// ~~ RESTFULL CRUD API ENDPOINTS ~~

app.post("/recipes", async (request, response) => {
  const authorizationHeader = request.headers["authorization"];

  if (!authorizationHeader) {
    response.status(401).send("Missing Authorization Header");
    return;
  }

  try {
    await Utilities.authorizeUser(authorizationHeader, auth);
  } catch (error) {
    response.status(401).send(error.message);
    return;
  }

  const newRecipe = request.body;

  const missingFields = Utilities.validateRecipePostPut(newRecipe);

  if (missingFields) {
    response
      .status(400)
      .send(`Recipe is not valid. Missing/invalid fields: ${missingFields}`);
    return;
  }

  const recipe = Utilities.sanitizeRecipePostPut(newRecipe);

  try {
    const firestoreResponse = await firestore.collection("recipes").add(recipe);

    const recipeId = firestoreResponse.id;

    response.status(201).send({ id: recipeId });
  } catch (error) {
    response.status(400).send(error.message);
  }
});

app.get("/recipes", async (request, response) => {
  const authorizationHeader = request.headers["authorization"];
  const queryObject = request.query;
  const category = queryObject["category"] ? queryObject["category"] : "";
  const orderByField = queryObject["orderByField"] ? queryObject["orderByField"] : "";
  const orderByDircetion = queryObject["orderByDircetion"] ? queryObject["orderByDircetion"] : "asc";
  const pageNumber = queryObject["pageNumber"] ? queryObject["pageNumber"] : "";
  const perPage = queryObject["perPage"] ? queryObject["perPage"] : "";

  let isAuth = false;
  let collectionRef = firestore.collection("recipes");

  try {
    await Utilities.authorizeUser(authorizationHeader, auth);

    isAuth = true;
  } catch (error) {
    collectionRef = collectionRef.where("isPublished", "==", true);
  }

  if(category) {
    collectionRef = collectionRef.where("category", "==", category);
  }

  if(orderByField) {
    collectionRef = collectionRef.orderby(orderByField, orderByDircetion);
  }

  if(perPage) {
    collectionRef = collectionRef.limit(Number(perPage));
  }

  if(pageNumber && pageNumber > 0){
    const pageNumberMultiplier = pageNumber -1;
    const offset = pageNumberMultiplier * perPage;
    collectionRef = collectionRef.offset(offset);
  }

  let recipeCount = 0;
  let countDocRef;

  if(isAuth) {
    countDocRef = firestore.collection("recipesCounts").doc("all");
  } else {
    countDocRef = firestore.collection("recipesCounts").doc("published");
  }

  const countDoc = await countDocRef.get();

  if(countDoc.exists) {
    const countDocData = countDoc.data();

    if(countDocData) {
      recipeCount = countDocData.count;
    }
  }

  try {
    const firestoreResponse = await collectionRef.get();
    const fetchedRecipes = firestoreResponse.docs.map((recipe) => {
      const id = recipe.id;
      const data = recipe.data();
      data.publishDate = data.publishDate._seconds;

      return {...data, id};
    });
    const payload = {
      recipeCount,
      documents: fetchedRecipes,
    }

    response.status(200).send(payload);
  } catch (error) {
    response.status(400).send(error.message);
  }

});

app.get('/', (req, res, next) => {
  res.send('Recipes API page');
})

if (process.env.NODE_ENV !== "production") {
  // Local dev
  app.listen(3005, () => {
    console.log("API started");
  });
}

module.exports = app;