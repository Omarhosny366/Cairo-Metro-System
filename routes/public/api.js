const { isEmpty } = require("lodash");
const { v4 } = require("uuid");
const db = require("../../connectors/db");
const roles = require("../../constants/roles");
module.exports = function (app) {
app.post("/api/v1/user", async function (req, res) {

    // Check if user already exists in the system
    const userExists = await db
      .select("*")
      .from("se_project.users")
      .where("email", req.body.email);
    if (!isEmpty(userExists)) {
      return res.status(400).send("user exists");
    }

    const newUser = {
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      email: req.body.email,
      password: req.body.password,
      roleid: roles.user,
    };
    try {
      const user = await db("se_project.users").insert(newUser).returning("*");


      return res.status(200).json(user );
    } catch (e) {
      console.log(e.message);
      return res.status(400).send("Could not register user");
    }
  });

  // Register HTTP endpoint to create new user
  app.post("/api/v1/user/login", async (req, res) => {
    const { email, password } = req.body;
  
    if (!email) {
      // If the email is not present, return an HTTP unauthorized code
      return res.status(400).send("Email is required");
    }
    if (!password) {
      // If the password is not present, return an HTTP unauthorized code
      return res.status(400).send("Password is required");
    }
  
    try {
      const user = await db
        .select("*")
        .from("se_project.users")
        .where("email", email)
        .first();
  
      if (isEmpty(user)) {
        return res.status(400).send("User does not exist");
      }
  
      if (user.password !== password) {
        return res.status(401).send("Password does not match");
      }
  
      // Set the expiry time as 15 minutes after the current time
      const token = v4();
      const currentDateTime = new Date();
      const expiresAt = new Date(+currentDateTime + 900000); // Expire in 15 minutes
  
      // Create a session containing information about the user and expiry time
      const session = {
        userid:user.id,
        token,
        expiresat:expiresAt,
      };
  
      await db("se_project.sessions").insert(session);
  
      // In the response, set a cookie on the client with the name "session_token"
      // and the value as the UUID we generated. We also set the expiration time.
      return res
        .cookie("session_token", token, { expires: expiresAt })
        .status(200)
        .send("Login successful");
    } catch (err) {
      console.log(err.message);
      return res.status(400).send("Could not login");
    }
  });
  
  app.post("/api/v1/tickets/price/:originId/:destinationId", async (req, res) => {
    try {
      const { originId, destinationId } = req.params;
      const visitedStations = []; // Add the visited stations to this array
  
      const originStation = await db("se_project.stations")
        .where("id", originId)
        .first();
        
      const destinationStation = await db("se_project.stations")
        .where("id", destinationId)
        .first();
  
      if (!originStation || !destinationStation) {
        return res.status(400).json({ error: "Invalid origin or destination" });
      }
      
      const route = await db("se_project.routes")
        .where("fromstationid", originId)
        .andWhere("tostationid", destinationId)
        .first();
  
      if (!route) {
        return res.status(400).json({ error: "No route found between the stations" });
      }
  
      const stationRoutes = await db("se_project.routes")
        .where("routeid", route.id)
        .orderBy("id");
  
      let totalCost = 0;
      let previousStationId = originId;
  
      for (const stationRoute of stationRoutes) {
        const [station] = await db("se_project.stations")
          .where("id", stationRoute.stationid).returning("*");
  
        if (!station) {
          return res.status(400).json({ error: "Invalid station" });
        }
        
        visitedStations.push(station.stationname);
        
        if (stationRoute.stationid === destinationId) {
          break; // Reached the destination, stop calculating cost
        }
  
        const zone = await db("se_project.zones").select("*")
          .where("zonetype", station.stationtype).returning("price");
  
        if (!zone) {
          return res.status(400).json({ error: "No zone found for the station" });
        }
  
        totalCost += zone;
        previousStationId = stationRoute.stationid;
      }
console.log(visitedStations);
      const numVisitedStations = visitedStations.length - 1; // Exclude the origin station from the count
      const ticketPrice = numVisitedStations * totalCost;
  
      return res.status(200).json({ ticketPrice, visitedStations });
    } catch (err) {
      console.log("Error:", err);
      return res.status(500).json({ error: "Failed to check ticket price" });
    }
  });
  
  
}