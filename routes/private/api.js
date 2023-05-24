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
       //Get the user from the session token
     
       const session_token = getSessionToken(req);
    const session = await db
      .select("*")
      .from("se_project.sessions")
      .where("token", session_token)
      .first();

    if (!session) {
      return res.status(401).send("Invalid session");
    }

    // Update the user's password in the database
    await db("se_project.users")
      .where("id", session.userid)
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

      return res.status(200).send(zones);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Internal server error");
    }
 
  });
 

  app.post("/api/v1/payment/subscription", async function (req, res) {
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
      const session_token = getSessionToken(req);
      const session = await db
        .select("*")
        .from("se_project.sessions")
        .where("token", session_token)
        .first();  
      
      if (!session) {
        return res.status(401).send("Invalid session");
      }
  
      const newTransaction = {
        purchasedid: purchasedId,
        userid: session.userid,
        amount: payedAmount,
      };
  
      // Insert the transaction into the transactions table
      const newTran = await db('se_project.transactions').insert(newTransaction).returning("*");
  
      const newSubscription = {
        subtype: subType,
        zoneid: zoneId,
        userid: session.userid,
        nooftickets: noOfTickets,
      };
  
      // Insert the subscription into the subscription table
      const newSub = await db('se_project.subscription').insert(newSubscription).returning("*");
  
      return res.status(200).json({ message: 'Subscription purchased successfully', nooftickets: noOfTickets });
    } catch (error) {
      console.error('Error inserting transaction or subscription:', error);
      return res.status(500).json({ error: 'Failed to process the payment' });
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