// This line is replaced during the build to reflect the required flat structure of a lambda nodejs app
const app = require("../app"); // DO NOT CHANGE

exports.handler = (event, context) => {
  console.log("Lambda Test Function");

  console.log("Here's some sample event data: %s", event.toString());

  context.done();
};
