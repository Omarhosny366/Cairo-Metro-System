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

  app.post("/api/v1/payment/ticket", async function (req, res) {
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
      const {
        purchasedId,
        creditCardNumber,
        holderName,
        payedAmount,
        Origin,
        Destination,
        tripDate,
      } = req.body;
  
      // Check if all required fields are provided
      if (
        purchasedId === undefined ||
        creditCardNumber === undefined ||
        holderName === undefined ||
        payedAmount === undefined ||
        Origin === undefined ||
        Destination === undefined ||
        tripDate === undefined
      ) {
        return res.status(400).send("All fields are required");
      }
      const currentDateTime = new Date();
      const ticketDateTime = new Date(tripDate);
      if (ticketDateTime <= currentDateTime) {
        return res.status(400).send("date is exits");
      }
      
      
        
      
  
      // Insert the ticket into the tickets table
      const [ticketId] = await db("se_project.tickets").insert({
        userid: session.userid,
        subid: null,
        origin: Origin,
        destination: Destination,
        tripdate: tripDate,
      }).returning("id");
      

      
      //const tickerId=await db .select("id").from("se_project.tickets")
      //.where("id",ticket.id)
      
  
      // Update the ride table with the new ticket information
       await db("se_project.rides").insert({
        status:"pending",
        origin: Origin,
        destination: Destination,
        userid: session.userid,
        ticketid:ticketId,
        tripdate:tripDate
 

      });
      await db("se_project.transactions").insert({
        amount:payedAmount,
        userid:session.userid,
        purchasediid:purchasedId,

      });
  
      return res
        .status(200)
        .send(`Ticket purchased successfully. Ticket ID: ${ticketId}`);
    } catch (e) {
      console.log(e.message);
      return res.status(500).send("Failed to purchase ticket");
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


  app.get("/api/v1/tickets/price/:originId&:destinationId", async (req, res) => {
    const originId = req.params.originId;
    const destinationId = req.params.destinationId;
  
    try {
      // Fetch the origin station details
      const originStation = await db
        .select("*")
        .from("se_project.stations")
        .where("id", originId)
        .first();
  
      // Fetch the destination station details
      const destinationStation = await db
        .select("*")
        .from("se_project.stations")
        .where("id", destinationId)
        .first();
  
      if (!originStation || !destinationStation) {
        return res.status(400).send("Invalid origin or destination station");
      }
  
      const visitedStations = [originStation.stationname];
  
      let totalPrice = 0;
      let currentStationId = originId;
  
      while (currentStationId !== destinationId) {
        const route = await db
          .select("se_project.routes.*")
          .from("se_project.routes")
          .join("se_project.stationroutes", "se_project.routes.id", "=", "se_project.stationroutes.routeid")
          .where("se_project.routes.fromstationid", currentStationId)
          .andWhere("se_project.stationroutes.stationid", currentStationId)
          .first();
  
        if (!route) {
          return res.status(400).send("No route found from the origin to the destination");
        }
  
        visitedStations.push(route.tostationid);
  
        totalPrice += 50;
        currentStationId = route.tostationid;
      }
  
      return res.status(200).json({ price: totalPrice, visitedStations });
    } catch (err) {
      console.log(err.message);
      return res.status(400).send("Error occurred while calculating the price");
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
  
  
  app.put("/api/v1/route/:routeId", async (req, res) => {
    try {
      const { routename } = req.body;
      const { routeId } = req.params;
      const updatedroutes = await db("se_project.routes")
        .where("id", routeId)
        .update({
          routename: routename,
          
        })
        .returning("*");
        return res.status(200).json(updatedroutes);
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update routes");
  }
  });
  
  
  app.delete("/api/v1/route/:routeId", async (req, res) => {
    try {
      const routeId = parseInt(req.params.routeId);
  
      const route = await db("se_project.routes").where("id", routeId).first();
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
  
      const { fromstationid, tostationid } = route;
  
      const fromStationRoutes = await db("se_project.routes")
      .select("fromstationid")
      .where("id", routeId);
      const toStationRoutes = await db("se_project.routes")
      .select("tostationid")
      .where("id", routeId);
      if (fromStationRoutes.length !=0 && toStationRoutes.length !=0 ) {
        await db("se_project.stations").where("id", fromstationid).update({
          stationstatus: "new",
          stationposition: "start",
        });
        await db("se_project.stations").where("id", tostationid).update({
          stationstatus: "new",
          stationposition: "end",
        });
      } else if (fromStationRoutes.length != 0) {
        await db("se_project.stations").where("id", fromstationid).update({
          stationstatus: "new",
          stationposition: "start",
        });
      } else if (toStationRoutes.length !=0) {
        await db("se_project.stations").where("id", tostationid).update({
          stationstatus: "new",
          stationposition: "end",
        });
      }
  
      await db("se_project.routes").where("id", routeId).del();
  
      return res.status(200).json({ message: "Route deleted successfully" });
    } catch (err) {
      console.log("Error:", err);
      return res.status(400).json({ error: "Could not delete route" });
    }
  });
  
  
  app.put("/api/v1/requests/refunds/:requestId", async (req, res) => {
    try {
      const  {reqStatus } = req.body;
      const { requestId } = req.params;
     
      const updatedstatus = await db("se_project.refund_requests")
        .where("id", requestId)
        .update({
          status : reqStatus
        })
        .returning("*");
        return res.status(200).json(updatedstatus);
      
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update refund status");
  }
  });
  
  app.put("/api/v1/requests/senior/:requestId", async (req, res) => {
    try {
        const {seniorStatus} = req.body;
        const {requestId} = req.params;
        const {userid}=await db("se_project.senior_requests")
        .select("userid")
        .where("id", requestId).first();
        const row = await db("se_project.roles")
        .where("role", "=", "senior")
        .first();
        const roleId = row.id;
        const row2 = await db("se_project.roles")
        .where("role", "=", "user")
        .first();
        const roleID = row2.id;
        
        const updatedSenior = await db("se_project.senior_requests")
          .where("id", requestId)
          .update( {
            status : seniorStatus
          })
          .returning("*");
          if(seniorStatus==="accepted"){
            const aa = await db("se_project.users")
            .where("id", userid)
            .update( {
              roleid : roleId
            })
            .returning("*");
          }
          else{
            const aa = await db("se_project.users")
            .where("id", userid)
            .update( {
              roleid : roleID
            })
            .returning("*");
          }
         return res.status(200).json(updatedSenior);    
    
    } catch (err) {
      console.log("eror message", err.message);
      return res.status(400).send("Could not update senior");
  }
  });
};