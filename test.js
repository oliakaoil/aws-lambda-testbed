const path = require("path");
const fs = require("fs");

if (process.argv.length < 3) {
  console.log("Usage: node ./test.js [task name] [event data json]");
  process.exit();
}

const task_name = process.argv[2];
const task_path = path.join(__dirname, "tasks", task_name) + ".js";

if (!fs.existsSync(task_path)) {
  console.log("Could not find task: " + task_path);
  process.exit();
}

let eventData = {};

// command-line event data input
if (process.argv.length > 3) {
  const eventData = process.argv[3];

  try {
    eventData = JSON.parse(eventData);
  } catch (err) {
    console.log("Error parsing event data", err);
    process.exit();
  }
}

const context = {
  done: function () {
    console.log("...context.done();");
    process.exit();
  },
  fail: function (err) {
    console.error("context.fail");
    console.error(err);
  },
  succeed: function (err) {
    console.log("context.succeed");
    console.log(err);
  },
};

const task = require(task_path);

task.handler(eventData, context);
