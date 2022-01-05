## Overview

This repository is a framework for building, testing and packaging Node.js apps that are designed to run in the AWS Lambda computing environment. Using this framework, each Node.js function (which are each Lambda tasks) are related by sharing a single Node.js (app.js) that can be used to load shared libraries, configuration values and other resources. Stand-alone Lambda tasks in effect become methods of a single application module, with a single set of dependencies and one environment.

The downside to this approach is that individual Lambda function packages are generally bigger in filesize and may contain dependencies which they do not actually need. The upside is that you can save time by consistently sharing resources like e-mail and database connections across functions, and cut down on the total amount of code required to manage and release a set of functions which are likely all related to the same application.

Lambda tasks are small, stand-alone functions that run in a special environment in the AWS cloud. In order to provide a common framework for these stand-alone tasks, you'll notice a main application script (app.js) and the expected use of the dotenv module for configuration values. These are the base that each Lambda stand-alone application uses as its common framework. The main application script can be used to provide access to any shared resource (i.e. Sequelize models for database access, configuration values, etc.) and other commonly needed objects, datastores, APIs and the like.

## Building and testing

Since it's difficult to recreate the exact environment in which Lambda functions execute in AWS, there is an alternative method of executing different tasks in a local development enviornment:

```
$ node ./test.js [task name] [event data]
```

The above script will execute the given task by name. All tasks (i.e. Lambda functions) should be placed in the tasks folder, and their filenames should match exactly the given name of the Lambda function in AWS. Take a look at the provided example task for details on how to structure task files. Note that if you pass stringified JSON as the last parameter, it will be parsed as JSON and passed as event data to the task.

## Distribution

Lambda functions must be uploaded to AWS as ZIP files with an expected structure. In order to create these ZIP files, do this:

```
$ node ./make.js
```

The above script copies the common framework files and the npm-managed dependencies into each ZIP file. It's likely that you may want to modify the make script in order to add paths and files to the ZIP file, or add functionality to pull in production versions of environment files. When developing locally, tasks are executed via the test script where the common framework files are shared and used from their current location.
