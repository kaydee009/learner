const fastify = require("fastify");
const path = require("path");
const uuid = require("uuid").v4;
const fastifySession = require("@fastify/session");
const fastifyCookie = require("@fastify/cookie");
const accountSid = "AC103d744f38a3a33aeff5e43ad50fbc04";
const authToken = "fc7ae5bbd259e0de52217f1a119f86d3";
const client = require("twilio")(accountSid, authToken);

const sqlite3 = require("sqlite3").verbose();
let db;
let otps = [];

let app = fastify();

app.register(require("@fastify/formbody"));

app.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
  root: "./views",
});

const fs = require("fs");
const pump = require("pump");
const fastifyMultipart = require("fastify-multipart");

app.register(fastifyMultipart);

// Encryption cookies
app.register(require("@fastify/cookie"), {
  secret: "VGGx0coCIkT7tNhE63eCgYqoeoGcml6nFD06", // for cookies signature
  hook: "onRequest", // set to false to disable cookie autoparsing or set autoparsing on any of the following hooks: 'onRequest', 'preParsing', 'preHandler', 'preValidation'. default: 'onRequest'
  parseOptions: {}, // options for parsing cookies
});

// let token = "fc7ae5bbd259e0de52217f1a119f86d3";
// let sid = "";
// let ph = "+13854176627";

app.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/public/",
});

app.get("/", (req, res) => {
  res.sendFile("homepage.html");
});

app.get("/login", (req, res) => {
  // Verify
  if (req.cookies.phone) res.redirect("/menu");

  res.sendFile("login.html");
});

app.post("/login", (req, res) => {
  let ph = req.body.phone;
  let pass = req.body.pass;
  console.log(req.body);

  db.get(
    "SELECT * FROM users WHERE phone = ? and pass = ? and verify = 1",
    [ph, pass],
    (err, data) => {
      if (err) throw err;
      if (!data) {
        console.log("Data is null");

        res.send("invalid details");
        return;
      }
      console.log(data);
      if (req.body.remember) {
        res.setCookie("phone", ph);
      } else {
        res.setCookie("phone", ph);
      }

      if (Object.keys(data).length > 0) {
        res.redirect("/menu");
      } else {
        res.send("Invalid Details");
      }
    }
  );
});

app.get("/signup", (req, res) => {
  res.sendFile("signup.html");
});

app.post("/otp", (req, res) => {
  if (req.body.phone.length != 10) res.send("Invalid OTP");

  console.log(req.body);

  let otp = Math.floor(100000 + Math.random() * 900000);
  db.run(
    "INSERT INTO users (fname, lname, phone, pass, verify) VALUES (?, ?, ?, ?, 1)",
    [req.body.fname, req.body.lname, req.body.phone, req.body.pass]
  );
  for (let o of otps) {
    if (o["phone"] == req.body.phone) {
      if (o["time"] - new Date().getMinutes() > 1) {
        delete opts[otps.indexOf(o)];
        break;
      } else {
        res.send("OTP already send, wait for minute");
        return;
      }
    }
  }

  res.setCookie("t", "+91" + req.body.phone);
  client.verify.v2
    .services("VA43990a55e53cc60dd5d83af1ea61233e")
    .verifications.create({
      to: "+91" + req.body.phone,
      channel: "sms",
      code: otp + "",
    })
    .then((verification) => console.log(verification))
    .then(() => {
      otps.push({
        phone: req.body.phone,
        otp: otp,
        time: new Date().getMinutes(),
      });

      console.log(otps);
    });

  // client.messages
  //   .create({
  //     body: "Thanks for signup on EatnTreat, your OTP is " + otp,
  //     from: "+13854176627",
  //     to: "+91" + req.body.phone,
  //   })
  //   .then((message) => {
  //     console.log(message.sid);

  //     otps.push({
  //       phone: req.body.phone,
  //       otp: otp,
  //       time: new Date().getMinutes(),
  //     });
  //   });

  // send OTP

  // verify if OTP is correct
  res.redirect("/login");
});

app.get("/aboutus", (req, res) => {
  res.sendFile("aboutus.html");
});

app.get("/faqs", (req, res) => {
  res.sendFile("faqs.html");
});

app.post("/verify", (req, res) => {
  // for (let o of otps) {
  //   if (o.otp == req.body.otp) {
  //     db.run("UPDATE users SET verify = 1 WHERE phone = ?", [o.phone]);
  //     delete otps[otps.indexOf(o)];
  //     found = true;
  //   }
  // }
  console.log(req.cookies);

  client.verify.v2
    .services("VA43990a55e53cc60dd5d83af1ea61233e")
    .verificationChecks.create({ to: req.cookies.t, code: req.body.otp })
    .then((verification_check) => {
      console.log(verification_check.status);

      if (verification_check.status == "approved") {
        db.run("UPDATE users SET verify = 1 WHERE phone = ?", [req.cookies.t]);
        res.redirect("/login");
      } else res.send("invalid otp");
    });
});

app.get("/menu", (req, res) => {
  if (!req.cookies.phone) res.redirect("/");

  res.sendFile("menu.html");
});

//
app.get("/getdetails", (req, res) => {
  console.log(otps);
  for (let o of otps) {
    if (o.phone == req.query.phone) {
      if (o["otp"] == req.query.otp) {
        res.view("input", { phone: req.query.phone });
      } else {
        res.send("Wrong OTP");
      }
    } else {
      console.log(o.phone + " " + req.query.phone);
    }
  }
});

app.get("/signout", (req, res) => {
  if (!req.cookies.phone) res.redirect("/");

  res.clearCookie("phone");
  res.redirect("/login");
});

//
app.post("/getdetails", async (req, res) => {
  const data = await req.file();

  // we must consume the file
  // we use pump to manage correctly the streams and wait till the end of the pipe
  const storedFile = fs.createWriteStream(
    "./photos/" + req.body.phone + ".png"
  );
  await pump(data.file, storedFile);

  return 0;
});

//
app.get("/items", (req, res) => {
  db.all("SELECT * FROM items;", (err, items) => {
    if (err) console.error(err);
    console.log(items);

    res.view("items", { it: items });
  });
});

//
app.post("/uploaditem", async (req, res) => {
  // return the first file submitted, regardless the field name
  const data = await req.file();

  console.log(req);

  const pname = data.fields.name.value;
  const pdesc = data.fields.desc.value;
  const price = data.fields.price.value;
  const id = uuid();

  db.run("INSERT INTO items (id, name, desc, price) VALUES (?, ?, ?, ?)", [
    id,
    pname,
    pdesc,
    price,
  ]);

  // we must consume the file
  // we use pump to manage correctly the streams and wait till the end of the pipe
  const storedFile = fs.createWriteStream(`./public/items/${id}.png`);
  await pump(data.file, storedFile);
});

app.listen("8080", () => {
  db = new sqlite3.Database("./db.sqlite");
  db.prepare(
    `CREATE TABLE IF NOT EXISTS users (fname TEXT, lname TEXT, phone VARCHAR(12), pass TEXT, verify INT)`
  )
    .run()
    .finalize();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS items (id TEXT, name TEXT, desc TEXT, price INT)`
  )
    .run()
    .finalize();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS orders (product TEXT, status TEXT, buyer TEXT)`
  )
    .run()
    .finalize();
  console.log(uuid());
  console.log("Server live");
});
