const path = require("path");
const fs = require("node-fs-extra");
const os = require("os");
const prompt = require("prompt");
const wrench = require("wrench");
const archiver = require("archiver");

const dist_path = path.join(__dirname, "dist");

if (!fs.existsSync(dist_path)) {
  console.error("could not read distribution path", dist_path);
  process.exit(1);
}

const task_basepath = path.join(__dirname, "tasks");
const tasks = fs.readdirSync(task_basepath);

if (!fs.existsSync(task_basepath)) {
  console.error("could not read task path", task_basepath);
  process.exit(1);
}

if (!tasks.length) {
  console.error("no tasks found");
  process.exit(1);
}

if (process.argv.length > 2) {
  const task = process.argv[2] + ".js";

  if (tasks.indexOf(task) != -1) {
    tasks = [task];
  }
}

const environment = process.argv.length > 3 ? process.argv[3] : "local";

switch (environment) {
  case "--prod":
    environment = "live";
    break;
  case "--dev":
    environment = "dev";
    break;
  case "local":
    break;
  default:
    console.error("unknown environment", environment);
    process.exit(1);
    break;
}

console.log("\nCreating %s version of task %s", environment, task);
console.log(
  "All matching zip files in the following distribution path will be unlinked: %s",
  dist_path
);
console.log(
  "\nFound %d matching task(s) in the following path: %s\n",
  tasks.length,
  task_basepath
);

prompt.start();

const schema = {
  properties: {
    "Yes/No": {
      required: true,
      type: "string",
      default: "Yes",
    },
  },
};

prompt.message =
  "Are you sure you want to create the distribution using the above paths?";
prompt.get(schema, function (err, result) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  if (result["Yes/No"].substr(0, 1).toLowerCase() != "y") {
    process.exit();
  }

  // Setup the temporary path where the tasks will be built and packaged
  const tmp_path = path.join(os.tmpdir(), "lambda-dist");
  if (!fs.existsSync(tmp_path)) {
    fs.mkdirSync(tmp_path);
  }

  const complete_count = 0;

  const folderCopyOpts = {
    forceDelete: true,
    excludeHiddenUnix: false,
    preserveFiles: false,
    preserveTimestamps: false,
    inflateSymlinks: false,
  };

  tasks.forEach(function (task_filename) {
    const task_path = path.join(task_basepath, task_filename);
    const task_name = path.basename(task_filename, ".js");
    const suffix = environment == "dev" ? "-dev" : "";
    const dest_path = path.join(dist_path, task_name) + suffix + ".zip";

    console.log("\nCreating archive %s", dest_path);

    if (fs.existsSync(dest_path)) {
      fs.unlinkSync(dest_path);
    }

    const package_files = [
      { source: task_path, target: path.basename(task_filename) },
      { source: path.join(__dirname, "app.js"), target: "app.js" },
      { source: path.join(__dirname, ".env"), target: ".env" },
      { source: path.join(__dirname, "toolbox.js"), target: "toolbox.js" },
    ];

    const envDepPath = path.join(__dirname, "environment-deps", environment);
    if (fs.existsSync(envDepPath)) {
      fs.readdirSync(envDepPath).forEach(function (file) {
        package_files.push({
          source: path.join(envDepPath, file),
          target: file,
        });
      });
    }

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "package.json"))
    );

    const zip_files = [];
    const zip_folders = [];

    const task_tmp_path = path.join(tmp_path, task_name);
    if (fs.existsSync(task_tmp_path)) {
      wrench.rmdirSyncRecursive(task_tmp_path, true);
    }
    fs.mkdirSync(task_tmp_path);
    const module_path_dest = path.join(task_tmp_path, "node_modules");
    fs.mkdirSync(module_path_dest);

    const archive = archiver.create("zip", {});

    archive.on("error", function (err) {
      throw err;
    });

    archive.on("end", function () {
      if (++complete_count < tasks.length) {
        return;
      }

      console.log("Removing temporary path %s", tmp_path);

      if (fs.existsSync(tmp_path)) {
        wrench.rmdirSyncRecursive(tmp_path, true);
      }
    });

    archive.pipe(fs.createWriteStream(dest_path));

    /*
     * Copy over the task files and common framework files, and update the task file path
     */
    package_files.forEach(function (package_file) {
      if (fs.statSync(package_file.source).isDirectory()) {
        const dest_path = path.join(task_tmp_path, package_file.target);

        wrench.copyDirSyncRecursive(
          package_file.source,
          dest_path,
          folderCopyOpts
        );
        zip_folders.push({ source: dest_path, target: package_file.target });
        return;
      }

      if (fs.existsSync(package_file.source)) {
        const source = package_file.source;
        const dest_path = path.join(
          task_tmp_path,
          path.basename(package_file.source)
        );

        fs.copySync(package_file.source, dest_path);

        // Update the path to the app module in the primary task file
        if (package_file.source == task_path) {
          const fileContent = fs.readFileSync(dest_path);
          fileContent = fileContent
            .toString()
            .replace(
              /const app = require\(.+\);/i,
              "const app = require('./app');"
            );
          fs.writeFileSync(dest_path, fileContent);
        }

        package_file.source = dest_path;
        zip_files.push(package_file);
      }
    });

    /*
     * Copy over module dependencies
     */
    const module_deps = [];
    const module_path_source = path.join(__dirname, "node_modules");

    const module_sources = fs.readdirSync(module_path_source);

    module_sources.forEach(function (module_name) {
      if (packageJson.exclude_deps.indexOf(module_name) != -1) return;

      const dest_path = path.join(module_path_dest, module_name);

      wrench.copyDirSyncRecursive(
        path.join(module_path_source, module_name),
        dest_path,
        folderCopyOpts
      );

      module_deps.push({
        source: dest_path,
        target: "node_modules/" + module_name,
      });
    });

    /*
     * Write all the files/folders in the prepared temporary path to the zip folder
     */

    module_deps.forEach(function (folder) {
      console.log(" + %s", folder.source);
      archive.directory(folder.source, folder.target);
    });

    zip_folders.forEach(function (folder) {
      console.log(" + %s", folder.source);
      archive.directory(folder.source, folder.target);
    });

    zip_files.forEach(function (file) {
      console.log(" + %s", file.source);
      archive.file(file.source, { name: file.target });
    });

    console.log("Finalizing archive");
    archive.finalize();
  });
});
