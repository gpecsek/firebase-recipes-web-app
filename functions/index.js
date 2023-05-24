const FirebaseConfig = require("./FirebaseConfig");
const functions = FirebaseConfig.functions;
const firestore = FirebaseConfig.firestore;
const storageBucket = FirebaseConfig.storageBucket;
const admin = FirebaseConfig.admin;

exports.onCreateRecipe = functions.firestore
  .document("recipes/{recipeId}")
  .onCreate(async (snapshot) => {
    const countDocRef = firestore.collection("recipesCounts").doc("all");
    const countDoc = await countDocRef.get();

    if (countDoc.exists) {
      countDocRef.update({ count: admin.firestore.FieldValue.increment(1) });
    } else {
      countDocRef.set({ count: 1 });
    }
    const recipe = snapshot.data();

    if (recipe.isPublished) {
      const countPublishedDocRef = firestore
        .collection("recipesCounts")
        .doc("published");
      const countPublishedDoc = await countPublishedDocRef.get();

      if (countPublishedDoc.exists) {
        countPublishedDocRef.update({
          count: admin.firestore.FieldValue.increment(1),
        });
      } else {
        countPublishedDocRef.set({ count: 1 });
      }
    }
  });

exports.onDeleteRecipe = functions.firestore
  .document("recipes/{recipeId}")
  .onDelete(async (snapshot) => {
    const recipe = snapshot.data();
    const imageUrl = recipe.imageUrl;

    if (imageUrl) {
      const decodedUrl = decodeURIComponent(imageUrl);
      const startIndex = decodedUrl.indexOf("/o/") + 3;
      const endIndex = decodedUrl.indexOf("?");
      const fullFilePath = decodedUrl.substring(startIndex, endIndex);
      const file = storageBucket.file(fullFilePath);

      console.log(`Attempting to delete ${fullFilePath}`);

      try {
        await file.delete();
        console.log("Successfully deleted image.");
      } catch (error) {
        console.log(`Failed to delete file: ${error.message}`);
      }

      const countDocRef = firestore.collection("recipesCounts").doc("all");
      const countDoc = await countDocRef.get();

      if (countDoc.exists) {
        countDocRef.update({ count: admin.firestore.FieldValue.increment(-1) });
      } else {
        countDocRef.set({ count: 0 });
      }
      const recipe = snapshot.data();

      if (recipe.isPublished) {
        const countPublishedDocRef = firestore
          .collection("recipesCounts")
          .doc("published");
        const countPublishedDoc = await countPublishedDocRef.get();

        if (countPublishedDoc.exists) {
          countPublishedDocRef.update({
            count: admin.firestore.FieldValue.increment(-1),
          });
        } else {
          countPublishedDocRef.set({ count: 0 });
        }
      }
    }
  });
