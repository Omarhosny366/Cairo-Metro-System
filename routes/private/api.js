const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
const {getSessionToken}=require('../../utils/session')
const getUser = async function (req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect("/");
  }
  console.log("hi",sessionToken);
  const user = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", sessionToken)
    .innerJoin(
      "se_project.users",
      "se_project.sessions.userid",
      "se_project.users.id"
    )
    .innerJoin(
      "se_project.roles",
      "se_project.users.roleid",
      "se_project.roles.id"
    )
   .first();

  console.log("user =>", user);
  user.isNormal = user.roleid === roles.user;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;
  console.log("user =>", user)
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
<<<<<<< HEAD
       //Get the user from the session token
      const sessionToken = req.cookies.session_token;
=======
      // Get the user from the session token
     const sessionToken = req.cookies.session_token;
>>>>>>> 6ba32dd27b6b6b67510ddd8e5edc7982d47e3e49
      const session = await db
        .select("userid")
        .from("se_project.sessions")
        .where("token", sessionToken)
<<<<<<< HEAD
        .first() 
=======
        .first()  
      
>>>>>>> 6ba32dd27b6b6b67510ddd8e5edc7982d47e3e49
           
      if (!session ) {
        return res.status(401).send("Invalid session");
      }

   

      // Update the user's password in the database
      await db("se_project.users")
        .where("id",session)
        .update({password:newPassword}).returning("*");

      return res.status(200).send("Password reset successful");
    } catch (e) {
      console.log(e.message);
      return res.status(500).send("Internal server error");
    }
  });
  app.get("/api/v1/zones", async function (req, res) {
    try {
      
      const zones = await db.select("*").from("se_project.zones");

      return res.status(200).send(zones);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Internal server error");
    }
 
  });
 
  app.post('/api/v1/payment/subscription', async (req, res) => {
    const { purchasedId, creditCardNumber, holderName, payedAmount, subType, zoneId } = req.body;
  
    let noOfTickets;
    if (subType === 'annual') {
      noOfTickets = 100;
    } else if (subType === 'quarterly') {
      noOfTickets = 50;
    } else if (subType === 'monthly') {
      noOfTickets = 10;
    } else {
      return res.status(400).json({ error: 'Invalid subscription type' });
    }
  
    try {
      const sessionToken = req.cookies.session_token;
      const session = await db
        .select("userid")
        .from("se_project.sessions")
        .where("token", sessionToken)
        .first()  
      
           
      if (!session ) {
        return res.status(401).send("Invalid session");
      }



      const newTransaction = {
        purchasedIid: purchasedId,
        userid: session,
        amount: payedAmount,
      };
  
      // Insert the transaction into the transactions table
      await db('se_project.transactions').insert(newTransaction);
  
      const newSubscription = {
        subtype: subType,
        zoneid: zoneId,
        userid: session,
        nooftickets: noOfTickets,
      };
  
      // Insert the subscription into the subscription table
      await db('se_project.subscription').insert(newSubscription);
  
      return res.status(200).json({ message: 'Subscription purchased successfully', noOfTickets });
    } catch (error) {
      console.error('Error inserting transaction or subscription:', error);
      return res.status(500).json({ error: 'Failed to process the payment' });
    }
  });
  

  app.put("/api/v1/payment/ticket", async function (req, res) {
    try {
      // Retrieve ticket details from the request body
      const { purchasedId, creditCardNumber, holderName, payedAmount, origin, destination, tripDate } = req.body;

      // Check if the user has a subscription
      const userSubscriptions = await db
        .select("*")
        .from("se_project.subsription")
        .where("userId", req.user.id); // Assuming user authentication and retrieving the user ID from the request

      let ticketPrice;
      let transferStations;

      if (userSubscriptions.length > 0) {
        // User has a subscription
        // Perform necessary logic to determine ticket price and transfer stations based on the subscription and route
        ticketPrice = 0; // Replace with your actual logic
        transferStations = []; // Replace with your actual logic
      } else {
        
        ticketPrice = 0; // Replace with your actual logic
        transferStations = []; // Replace with your actual logic
      }

     
      const newTicket = {
        origin,
        destination,
        userId: req.user.id,
        subID: null, // Assuming the user doesn't have a subscription
        tripDate,
      };
      const ticket = await db("se_project.tickets").insert(newTicket).returning("*");

      const newTransaction = {
        amount: req.body.payedAmount,
        userId: req.user.id,
        purchasedid:req.body.purchasedId
      };
      await db("se_project.transactions").insert(newTransaction);

      const response = {
        ticket,
        ticketPrice,
        transferStations,
      };
      return res.status(200).json(response);
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
app.put("/api/v1/refund/:ticketId", async function (req, res) {
  const ticketId = req.params.ticketId;

  try {
    // Retrieve the ticket from the database
    const ticket = await db("se_project.tickets")
      .where("id", ticketId)
      .first();

    // Check if the ticket exists
    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    // Check if the ticket is for a future ride
    const currentDateTime = new Date();
    const ticketDateTime = new Date(ticket.tripDate);
    if (ticketDateTime <= currentDateTime) {
      return res.status(400).send("Cannot refund past or current dated tickets");
    }

    // Retrieve the user's subscription from the subscription table
    const userSubscription = await db("se_project.subscriptions")
      .where("userid", ticket.userid)
      .first();

    // Check if the user has a subscription
    if (userSubscription) {
      // Check if there is a ticket associated with the user ID and subscription ID
      const associatedTicket = await db("se_project.tickets")
        .where("userid", ticket.userId)
        .where("subid", userSubscription.id)
        .first();

      if (associatedTicket) {
        // Refund the ticket by updating the transaction status
        await db("se_project.refund_requests").insert({
          ticketid: ticketId,
          status: "pending",
          userid:ticket.userid,
          
        });

        return res.status(200).send("Ticket refund requested");
      }
    }else{
      const onlineticket = await db("se_project.tickets")
      .where("userid", ticket.userId)
      .first();
       if(onlineticket){
        await db("se_project.refund_requests").insert({
          ticketid: ticketId,
          status: "pending",
          userid:ticket.userid,
          
        });
        return res.status(200).send("Ticket refund requested");
       }



    }
      
    

    return res.status(400).send("Cannot refund ticket without a valid subscription");
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Failed to refund ticket");
  }
});


///////////////////////////////////////////////////////////////
  ////////////////////////admin methods/////////////////////////
  //////////////////////////////////////////////////////////////
  
  app.post("/api/v1/station", async function (req, res)   {

    const stationexists = await db
    .select("*")
    .from("se_project.stations")
    .where("stationname", req.body.stationname);
  if (!isEmpty(stationexists)) {
    return res.status(400).send("station exists")
  }
  const newStation ={
    stationname:req.body.stationname,
    stationtype :req.body.stationtype,
    stationposition :req.body.stationposition,
    stationstatus :req.body.stationstatus
  };
    try {
      const addedStation = await db("se_project.stations")
        .insert(newStation)
        .returning("*");
      return res.status(200).json(addedStation);
    } 
    catch (e) {
      console.log("error message", e.message);
      return res.status(400).send(err.message);
    }
  });
  
  app.put("/api/v1/station/:stationId", async (req, res) => {
    try {
      const { stationname } = req.body;
      const { stationId } = req.params;
      const updatedStation = await db("se_project.stations")
        .where("id", stationId)
        .update({
          stationname: stationname,
          
        })
        .returning("*");
        return res.status(200).json(updatedStation);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update Stations");
  }
  });
  app.delete("/api/v1/station/:stationId", async (req, res) => {
    try {
      const { stationId } = req.params;
  
      // Step 1: Find routes where the given station is either the 'fromStationId' or 'toStationId'
      const dependentRoutes = await db("se_project.routes")
        .where({ fromStationid: stationId })
        .orWhere({ toStationid: stationId });
  
      // Step 2: Create new arrays for 'fromStationid' and 'toStationid'
      const fromStationIds = [];
      const toStationIds = [];
  
      // Step 3: Iterate through dependentRoutes and add 'fromStationid' and 'toStationid' to respective arrays
      dependentRoutes.forEach((route) => {
        if (route.fromStationid === stationId) {
          toStationIds.push(route.toStationid);
        } else {
          fromStationIds.push(route.fromStationid);
        }
      });
  
      // Step 4: Create new dependencies and routes array
      const newDependencies = [];
      const newRoutes = [];
  
      // Step 5: Iterate through fromStationIds and combine with toStationIds to create new dependencies and routes
      fromStationIds.forEach((fromId) => {
        toStationIds.forEach((toId) => {
          newDependencies.push({ fromStationid: fromId, toStationid: toId });
          newRoutes.push({ routename: `Route from ${fromId} to ${toId}`, fromStationid: fromId, toStationid: toId });
        });
      });
  
      // Step 6: Insert new dependencies into the 'stationRoutes' table
      await db("se_project.stationRoutes").insert(newDependencies);
  
      // Step 7: Insert new routes into the 'routes' table
      await db("se_project.routes").insert(newRoutes);
  
      // Step 8: Delete the station with the given stationId
      await db("se_project.stations").where("id", stationId).del();
  
      return res.status(200).json({ message: "Station deleted successfully" });
    } catch (err) {
      console.log("error message", err.message);
      return res.status(400).send("Could not delete station");
    }
  });
  
};