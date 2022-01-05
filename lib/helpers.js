const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("request");
const uniqid = require("uniqid");
const md5 = require("MD5");
const email = require("emailjs/email");

const sendEmail = (message, done) => {
  const server = email.server.connect({
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSOWRD,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    ssl: process.env.EMAIL_SSL,
    tls: process.env.EMAIL_TLS,
    timeout: 10 * 1000,
  });

  message.attachment = [];

  if (typeof message.subject != "string" || !message.subject) {
    message.subject = "";
  }

  if (typeof message.text != "string" || !message.text) {
    message.text = "";
  }

  if (typeof done != "function") {
    done = function (err, message) {
      console.log(err || message);
    };
  }

  if (message.html) {
    message.attachment.push({
      data: message.html,
      alternative: true,
      type: "text/html",
    });
    delete message.html;
  }

  if (!process.env.EMAIL_SEND_ENABLED) {
    const { to, from, subject } = message;
    console.log("skipping actual sending of e-mail in development environment");
    console.log("to: %s | from: %s | subject: %s", to, from, subject);
    done(null, {});
    return true;
  }

  server.send(message, done);

  return true;
};

const renderHtml = (template_path, data) => {
  data = typeof data == "object" ? data : {};
  const template = fs.readFileSync(template_path + ".html", "utf8");

  Object.keys(data).forEach(function (prop) {
    const val = data[prop];
    const token = "!{" + prop + "}";
    const re = new RegExp(token, "g");
    template = template.replace(re, val);
  });

  return template;
};

const downloadFile = (url, download_path, done) => {
  if (!download_path) {
    download_path = path.join(os.tmpdir(), md5(uniqid() + String(Date.now())));

    // maintain file extension if possible
    const filename_parts = url.split("/").pop().split(".");

    if (filename_parts.length > 1) {
      download_path = download_path + "." + filename_parts.pop();
    }
  }

  const file = fs.createWriteStream(download_path);

  request.get(url).on("response", function (response) {
    if (response.statusCode != 200) {
      return false;
    }

    response.pipe(file, { end: false });

    response.on("end", function () {
      file.end();

      if (typeof done == "function") {
        done(url, download_path);
      }
    });
  });
};

const formatPlural = (count, single, multiple) => {
  const str = count == 1 ? single : multiple;
  return str.replace("@count", count);
};

// http://stackoverflow.com/questions/13627308/add-st-nd-rd-and-th-ordinal-suffix-to-a-number
const ordinalSuffix = (i) => {
  const j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }

  if (j == 2 && k != 12) {
    return i + "nd";
  }

  if (j == 3 && k != 13) {
    return i + "rd";
  }

  return i + "th";
};

module.exports = {
  sendEmail,
  downloadFile,
  renderHtml,
  formatPlural,
  ordinalSuffix,
};
