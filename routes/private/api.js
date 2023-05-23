const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const {getSessionToken}=require('../../utils/session')
const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/"); //Might be issue
  }
  console.log("hi",sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userId",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleId",
      "se_project.roles.id"
    )
   .first();

  console.log("user =>", user);
  user.isNormal = user.roleId === roles.user;
  user.isAdmin = user.roleId === roles.admin;
  user.isSenior = user.roleId === roles.senior;
  return user;
};

module.exports = function (app) {
  // example
  app.put("/users", async function (req, res) {
    try {
       const user = await getUser(req);
     // const {userId}=req.body
     console.log("hiiiiiiiiiii");
      const users = await db.select('*').from("se_project.users")
        
      return res.status(200).json(users);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not get users");
    }
  });
 
  app.put("/api/v1/password/reset", async function (req, res) {
    const { newPassword } = req.body;

    // Check if the new password is provided
    if (!newPassword) {
      return res.status(400).send("New password is required");
    }

    try {
      // Get the user from the session token
      const sessionToken = req.cookies.session_token;
      const session = await db
        .select("userId")
        .from("se_project.sessions")
        .where("token", sessionToken)
        .first() 
      
           
      if (!session ) {
        return res.status(401).send("Invalid session");
      }

      // Update the user's password in the database
      await db("se_project.users")
        .where("id", session.userId)
        .update({ password: newPassword });

      return res.status(200).send("Password reset successful");
    } catch (e) {
      console.log(e.message);
      return res.status(500).send("Internal server error");
    }
  });
  app.get("/api/v1/zones", async function (req, res) {
    try {
      
      const zones = await db.select("*").from("se_project.zones");

      return res.status(200).json(zones);
    } catch (e) {
      console.log(e.message);
      return res.status(500).send("Internal server error");
    }
 
  });

  const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'your-database-connection-string',
});

app.post('/api/v1/payment/subscription', async (req, res) => {
  const purchasedId = req.body.purchasedId;
  const creditCardNumber = req.body.creditCardNumber;
  const holderName = req.body.holderName;
  const payedAmount = req.body.payedAmount;
  const subType = req.body.subType;
  const zoneId = req.body.zoneId;

  try {
    // Perform necessary operations to process the payment
    const paymentRequest = {
      purchasedId: purchasedId,
      creditCardNumber: creditCardNumber,
      holderName: holderName,
      amount: payedAmount,
      // Additional payment request parameters if needed
    };

    // Send the payment request to the payment gateway or payment service provider
    const paymentResponse = await paymentGateway.processPayment(paymentRequest);

    if (paymentResponse.success) {
      // Payment successful
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Store the transaction details in the database (e.g., using the 'transactions' table)
        const transactionData = {
          amount: payedAmount,
          userid: req.user.id,
          purchasedIid: purchasedId,
        };
        const transactionResult = await client.query(
          'INSERT INTO se_project.transactions (amount, userid, purchasedIid) VALUES ($1, $2, $3) RETURNING id',
          [transactionData.amount, transactionData.userid, transactionData.purchasedIid]
        );
        const transactionId = transactionResult.rows[0].id;

        // Store the subscription details in the database (e.g., using the 'subscription' table)
        const subscriptionData = {
          subtype: subType,
          zoneid: zoneId,
          userid: req.user.id,
          nooftickets: 0, // Assuming initial number of tickets is 0, adjust as needed
        };
        await client.query(
          'INSERT INTO se_project.subscription (subtype, zoneid, userid, nooftickets) VALUES ($1, $2, $3, $4)',
          [subscriptionData.subtype, subscriptionData.zoneid, subscriptionData.userid, subscriptionData.nooftickets]
        );

        await client.query('COMMIT');

        // Return a response indicating successful payment
        res.status(200).json({ message: 'Payment for subscription successful.' });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } else {
      // Payment failed
      res.status(400).json({ message: 'Payment for subscription failed.' });
    }
  } catch (error) {
    res.status(500).json({ message: 'An error occurred during payment processing.' });
  }
});


///////////////////////////////////////////////////////////////
  ////////////////////////admin methods/////////////////////////
  //////////////////////////////////////////////////////////////
  
 app.put("/api/v1/password/reset", async function (req, res) {
  const { newPassword } = req.body;

  
  if (!newPassword) {
    return res.status(400).send("New password is required");
  }

  try {
    
    const sessionToken = req.cookies.session_token;
    const session = await db
      .select("userId")
      .from("se_project.sessions")
      .where("token", sessionToken)
      .first() 
    
    const adminRole = await db
      .select("id")
      .from("se_project.roles")
      .where("role", "=", "admin");
         
    if (!session && !adminRole) {
      return res.status(401).send("Invalid session");
    }

   
    await db("se_project.users")
      .where("id", session.userId)
      .update({ password: newPassword });

    return res.status(200).send("Password reset successful");
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Internal server error");
  }
});
app.post("/api/v1/station", async (req, res) => {
  try {
    const { id, stationname, stationtype, stationposition, stationstatus} =
      req.body;
    console.log(req.body);
    let newstation = {
      id,
      stationname,
      stationtype,
      stationposition,
      stationstatus
    };
    const addedstation = await db("stations").insert(addedstation).returning("*");
    console.log(addedstation);
    return res.status(201).json(addedstation);
} catch (err) {
    console.log("eror message", err.message);
    return res.status(400).send(err.message);
}
});
};