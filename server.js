const app = require("./app");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

//console.log(process.env.PORT);

app.get("/", (req, res) => {
  res
    .status(200)
    .json({ message: "Hello from the server side!", app: "login-signup" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Listening to ${port}...`);
});
