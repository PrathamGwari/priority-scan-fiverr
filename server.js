const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const {
  registerUser,
  loginUser,
  isLoged,
  verifyToken,
  currentUserData,
  updateUserData,
} = require("./controllers/userController");
const { createPaymentIntent } = require("./controllers/paymentController");
const stripe = require("stripe")(process.env.STRIPE_API_KEY);
const connectToDB = require("./dbConnection");
const User = require("./models/userModel");
const {
  getHospitalWithClosestAppointment,
} = require("./controllers/hospitalController");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8181;
app.use(express.static(path.join(__dirname, "build")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.use(express.json());
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(cors());
connectToDB();

const YOUR_DOMAIN = "http://priorityscan.s3-website.us-east-2.amazonaws.com/";

// Serve index.html for any other routes to enable client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.post("/api/users/register", registerUser);
app.post("/api/users/login", loginUser);
app.post("/api/users/isloged", isLoged);
app.post("/api/users/userdata", currentUserData);
app.post("/api/users/updateuserdata", updateUserData);
app.get("/api/users/isloged", isLoged);

app.post("/api/hospitals/getclosest", getHospitalWithClosestAppointment);

app.post("/api/create-payment-intent", async (req, res) => {
  const { items } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: "799",
    currency: "cad",
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/api/create-checkout-session", async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded",
    line_items: [
      {
        // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
        price: "price_1OBl96CzamtkVis6A60paGtI",
        quantity: 1,
      },
    ],
    mode: "payment",
    return_url: `${YOUR_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
    automatic_tax: { enabled: true },
  });

  res.send({ clientSecret: session.client_secret });
});

app.get("/session-status", async (req, res) => {
  const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

  res.send({
    status: session.status,
    customer_email: session.customer_details.email,
  });
});

app.get("/", (req, res) => {
  res.status(200).send("Proxy is working!");
});

