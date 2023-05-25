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
 const t_id =parseInt(req.params.ticketId);
  try {
    const session_token = getSessionToken(req);
    const session = await db
    .select("*")
    .from("se_project.sessions")
    .where("token", session_token)
    .first();

    const ticket = await db
    .from("se_project.tickets").select("*")
    .where("id", t_id);

   

     //Check if the ticket exists
    if (!ticket) {
      return res.status(404).send("Ticket not found");
    }

    // Check if the ticket is for a future ride
    const currentDateTime = new Date();
    const ticketDateTime = new Date(ticket.tripdate);
    if (ticketDateTime <= currentDateTime) {
      return res.status(400).send("Cannot refund past or current dated tickets");
    }
    const ticketPrice =Math.floor(Math.random() * 91) + 10;

    // Retrieve the user's subscription from the subscription table
    const userSubscription = await db.select("*").from("se_project.subcsription")
      .where("userid",session.userid)
     .first();

    // Check if the user has a subscription
    if (userSubscription) {
      // Check if there is a ticket associated with the user ID and subscription ID
      const associatedTicket = await db.select("*").from("se_project.tickets")
        .where("userid", session.userid)
        .where("subid", userSubscription.id);
        

      if (associatedTicket) {
        // Refund the ticket by updating the transaction status
        await db("se_project.refund_requests").insert({
          ticketid: t_id,
          status:"pending",
          userid:session.userid,
          refundamount:ticketPrice
          
        });

        return res.status(200).send("Ticket refund requested");
      }
    }else{
      const onlineticket = await db.select("*").from("se_project.tickets")
      .where("userid", session.userid)
      .first();
       if(onlineticket){
        await db("se_project.refund_requests").insert({
          ticketid:t_id,
          status: "pending",
          userid:session.userid,
          
        });
        return res.status(200).send("Ticket refund requested");
       }
    }
    return res.status(400).send("Cannot refund ticket without a valid subscription");
  } catch (e) {
    console.log(e.message);
    return res.status(500).send("Failed to refund ticket" );
  }
});

  //Check Price
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
  
      // Fetch all routes that include the origin station
      const routes = await db
        .select("se_project.routes.*")
        .from("se_project.routes")
        .join("se_project.stationroutes", "se_project.routes.id", "=", "se_project.stationroutes.routeid")
        .where("se_project.stationroutes.stationid", originId);
  
      let totalPrice = 0;
      let visitedStations = [originId];
  
      // Recursive function to calculate the price by traversing the routes
      const calculatePrice = (currentStationId) => {
        for (const route of routes) {
          if (route.fromstationid === currentStationId) {
            // Add the price of the current route to the total price
            totalPrice += 50;
  
            // Add the destination station ID to the visited stations array
            visitedStations.push(route.tostationid);
  
            if (route.toStationid === destinationId) {
              // Reached the destination, return the total price
              return totalPrice;
            } else {
              // Continue recursively to the next station in the route
              const nextStationId = route.tostationid;
              return calculatePrice(nextStationId);
            }
          }
        }
  
        // No route found from the current station to the destination
        return null;
      };
  
      const finalPrice = calculatePrice(originId);
  
      if (finalPrice === null) {
        return res.status(400).send("No route found from the origin to the destination");
      }
  
      // Return the final price and visited stations array as the response
      return res.status(200).json({ price: finalPrice, visitedStations });
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
  
  app.put("/api/v1/zones/:zoneId", async (req, res) => {
    try {
      const  Price  = parseInt(req.body.Price); 
      const { zoneId } = req.params;

    const updatedZone = await db("se_project.zones")
      .where("id", zoneId)
      .update({
        price: Price,

      })
      .returning("*");
      return res.status(200).json(updatedZone);
  } catch (err) {
    console.log("eror message", err.message);
    return res.status(400).send("Could not update zone price");
}
});

app.post("/api/v1/route", async function (req, res) {
  try {
    const fromStationId = req.body.Fromstationid;
    const toStationId = req.body.Tostationid;
    const routeName = req.body.routename;

    const existingStations = await db("se_project.stations").where("id", fromStationId);
    const existingStations2 = await db("se_project.stations").where("id", toStationId);

    if (!existingStations || !existingStations2) {
      return res.status(400).send("Re-enter station IDs");
    } else {
      const newRoute = await db("se_project.routes")
        .insert({
          fromstationid: fromStationId,
          tostationid: toStationId,
          routename: routeName,
        }).returning("*");

      return res.status(200).json(newRoute);
    }
  } catch (error) {
    console.log(error.message);
    return res.status(400).send("Could not create route");
  }
});
};