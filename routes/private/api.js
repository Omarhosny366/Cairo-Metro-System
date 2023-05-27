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
  app.get("/users", async function (req, res) {
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

    if (!newPassword) {
      return res.status(400).send("New password is required");
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
 

  app.post("/api/v1/payment/subscription",async function(req,res){
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
      const {creditCardNumber, holderName, Payedamount, subtype, zoneId } = req.body;
  
  if(
  creditCardNumber===undefined||
  holderName===undefined||
  Payedamount===undefined||
  subtype===undefined||
  zoneId===undefined
  
  ){
    return res.status(400).send("All fields are required");
  }
  
  let Nooftickets;
  if (subtype === "annual") {
    Nooftickets = 100;
  } else if (subtype === "quarterly") {
    Nooftickets = 50;
  } else if (subtype === "monthly") {
    Nooftickets = 10;
  } else {
    return res.status(400).send("Invalid subscription type");
  }
  
  
  
  
  const [sub] =await db ("se_project.subcsription").insert({
  userid:session.userid,
  subtype:subtype,
  zoneid:zoneId,
  nooftickets:Nooftickets,
    }).returning("*");
    
  const [transactionsId]=await db ("se_project.transactions").insert({
  userid: session.userid,
  purchasediid: sub.id,
  amount:Payedamount,
  purchasetype:"subscription"
  }).returning("id");
  
    return res
    .status(200)
    .send(`Subscription purchased successfully. Number of tickets: ${Nooftickets}`);
  } catch (e) {
  console.log(e.message);
  return res.status(500).send("Failed to purchase subscription");
  }
  })
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
        creditCardNumber,
        holderName,
        payedAmount,
        Origin,
        Destination,
        tripDate,
      } = req.body;
  
      // Check if all required fields are provided
      if (
        
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
        purchasediid:ticketId,
        purchasetype:"ticket"

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

  //Check Price
  app.get("/api/v1/tickets/price/:originId&:destinationId", async (req, res) => {
    const originId = parseInt(req.params.originId);
    const destinationId = parseInt(req.params.destinationId);
  
    try {
      // Fetch the origin station details
      let originStation = await db
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
  
      let totalPrice = 0;
      let currentStationId = originId;
      let destinationStationId = destinationId;
      let currentStationType = originStation.stationtype;
      let destinationStationType = destinationStation.stationtype;
      let counter = 1;
  
      while (currentStationId <destinationStationId) {
        const priceResult = await db
          .select("price")
          .from("se_project.zones")
          .where("zonetype", currentStationType)
          .returning("*");
  
        if (priceResult.length === 0) {
          return res.status(400).send("No price found for the zone");
        }
  
        const { price } = priceResult[0];
        totalPrice += price;
  
        currentStationId += counter;
  
        originStation = await db
          .select("*")
          .from("se_project.stations")
          .where("id",currentStationId)
          .first().returning("*");
          console.log(originStation.id)
  
        if (!originStation) {
          return res.status(400).send("Invalid origin or destination station");
        }
  
        currentStationType = originStation.stationtype;
        counter += 1;
      }
  
      const priceResult = await db
        .select("price")
        .from("se_project.zones")
        .where("zonetype", destinationStationType)
        .returning("*");
  
      if (priceResult.length === 0) {
        return res.status(400).send("No price found for the destination zone");
      }
  
      const { price } = priceResult[0];
      totalPrice += price;
  
      return res.status(200).json({ price: totalPrice });
    } catch (err) {
      console.log(err.message);
      return res.status(400).send("Error occurred while calculating the price");
    }
  });
  
 
  
  
  
  
  
  

  app.post("/api/v1/tickets/purchase/subscription", async (req, res) => {
    try {
      const { subId, Origin, Destination,tripDate} = req.body;
      const session_token = getSessionToken(req);
      const session = await db
        .select("*")
        .from("se_project.sessions")
        .where("token", session_token)
        .first();
  
      if (!session) {
        return res.status(401).send("Invalid session");
      }
  
    
      const subscription = await db("se_project.subscription")
        .where("id", subId)
        .andWhere("userid", session.userid) ///////write user session here//////
        .first();
  
      if (!subscription) {
        return res.status(400).json({ error: "Invalid subscription ID or user does not have a subscription." });
      }
      if (subscription.nooftickets === 0) {
        return res.status(400).json({ error: "No available tickets in the subscription." });
      }
    
  
      const [ticket] = await db("se_project.tickets")
        .insert({
          origin:Origin,
          destination:Destination,
          userid:session.userid,
          subid:subId,
          tripdate: tripDate,
        }).returning("*");
        await db("se_project.subscription").where("userid",session.userid).decrement("nooftickets", 1);
        await db("se_project.rides").insert({
          status:"pending",
          origin: Origin,
          destination: Destination,
          userid: session.userid,
          ticketid:ticket.id,
          tripdate:tripDate
   
  
        });





return res.status(200).send("ticket is purchased ");
}
catch(error) {
  console.error(error);
  return res.status(500).send("Error processing the request");

}
  });
  
  app.post("/api/v1/senior/request", async (req, res) => {
    const { nationalid } = req.body;
//check nationalid
  if (!nationalid) {
    return res.status(400).send("National ID is required");
  }
//get user id from the current session
try{
  const session_token =getSessionToken(req);
   const session = await db
  .select("*")
  .from("se_project.sessions")
  .where("token", session_token)
  .first();

if(!session)
  return res.status(401).send("Invalid session");



//create senior request
const seniorRequest = {
  status: "Pending",
  userid:session.userid,
  nationalid: nationalid,
};

await db("se_project.senior_requests").insert(seniorRequest);

return res.status(200).send("Senior request submitted");
}
catch(error) {
  console.error(error);
  return res.status(500).send("Error processing the request");
}});

  
  //insert command table senior request - nationalid and user id i retrieved 
//add a pending status
//insert into table-requests(status,userid,nationalid)
//values(add values)
//return star -----> checkkk <-----
//try and catch --- console.log err.message(result.ststus 500)
  app.put("/api/v1/ride/simulate", async (req, res) => {
    try {
      const { origin, destination, tripDate } = req.body;
      const session_token = getSessionToken(req);
      const session = await db
        .select("*")
        .from("se_project.sessions")
        .where("token", session_token)
        .first();
  
      if (!session) {
        return res.status(401).send("Invalid session");
      } 
      const originStation = await db("se_project.stations")
        .where("stationname", origin)
        .first();
      const destinationStation = await db("se_project.stations")
        .where("stationname", destination)
        .first();

      if (!originStation || !destinationStation) {
        return res.status(400).json({ error: "Invalid origin or destination" });
      }


      const ticket = await db("se_project.tickets")
        .select("id")
        .where("userid", session.userid)///////write user session here//////
        .first();

      if (!ticket) {
        return res.status(400).json({ error: "No ticket found for the user" });
      }

      const ticketId = ticket.id;


      const ride = await db("se_project.rides")
        .insert({
          status: "completed",
          origin: origin,
          destination: destination,
          userid: session.userid,///////write user session here//////
          ticketid: ticketId,
          tripdate: tripDate,
        })
        .returning("*");

      return res.status(200).json(ride);
    } catch (err) {
      console.log("Error:", err);
      return res.status(500).json({ error: "Failed to simulate ride" });
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
      const { reqStatus } = req.body;
      const { requestId } = req.params;
  
      const [refundRequest] = await db("se_project.refund_requests")
        .where("id", requestId)
        .returning("*");
  
      
  
      const [userId] = await db("se_project.refund_requests")
        .select("userid")
        .where("id", requestId);
  
      
  
      const [refundAmount] = await db("se_project.refund_requests")
        .select("refundamount")
        .where("id", requestId);
  
      
  
      const [transaction] = await db("se_project.transactions")
        .select("*")
        .where("userid", userId.userid);
  
      
      const [ticket] = await db("se_project.tickets")
        .select("*")
        .where("id", refundRequest.ticketid);
  
      
  
      if (reqStatus === "accepted") {
        

        if (!ticket.subid) {
        
        const [userIdd] = await db("se_project.refund_requests")
        .select("userid")
        .where("id", requestId);
       
       
        const [transactionn] = await db("se_project.transactions")
        .select("*")
        .where("userid", userIdd.userid);
       
        const newamount = transactionn.amount - refundAmount.refundamount;
       
          const updatedTransaction = await db("se_project.transactions")
            .where("userid", userIdd.userid)
            .update({
              amount: newamount
            })
            .returning("*");
  
         
        } else {
          const [subscription] = await db("se_project.subsription")
            .where("id", ticket.subid)
            .select("*");
  
          const updatedSubscription = await db("se_project.subsription")
            .where("id", ticket.subid)
            .update({
              nooftickets: subscription.nooftickets + 1
            })
            .returning("*");
  
          
        }
      }
  
      const updatedStatus = await db("se_project.refund_requests")
        .where("id", requestId)
        .update({
          status: reqStatus
        })
        .returning("*");
  
      
  
      return res.status(200).json(updatedStatus);
    } catch (err) {
      console.log("Error message:", err.message);
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
  app.put("/api/v1/zones/:zoneId", async (req, res) => {
    try {
      const { zoneId } = req.params;
      const { price } = req.body;
  
      const updatedZone = await db("se_project.zones")
        .where("id", zoneId)
        .update({
          price: price
        })
        .returning("*");
  
      return res.status(200).json(updatedZone);
    } catch (err) {
      console.log("Error message:", err.message);
      return res.status(400).send("Could not update zone price");
    }
  });
  
};