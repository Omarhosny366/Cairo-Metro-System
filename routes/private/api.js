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

      return res.status(200).send(zones);
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Internal server error");
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

  
  

///////////////////////////////////////////////////////////////
  ////////////////////////admin methods/////////////////////////
  //////////////////////////////////////////////////////////////
  app.post("/api/v1/station", async function (req, res)   {

    const stationexists = await db
    .select("*")
    .from("se_project.stations")
    .where("stationname", req.body.stationName);
  if (!isEmpty(stationexists)) {
    return res.status(400).send("station exists");
  }
  const newStation ={
    stationname:req.body.stationName,
    stationtype :req.body.stationType,
    stationposition :req.body.stationPosition,
    stationstatus :req.body.stationStatus
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
      return res.status(400).send("Could not update employee");
  }
  });

};