require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const createPaymentIntent = async (req, res) => {
    const { paymentMethodId, amount, currency } = req.body;
  
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method: paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
      });
  
      res.json({ client_secret: paymentIntent.client_secret });
    } catch (error) {
      res.json({ error: error.message });
    }
  };
  
  module.exports = { createPaymentIntent };