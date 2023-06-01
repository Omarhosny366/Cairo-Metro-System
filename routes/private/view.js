const db = require('../../connectors/db');
const roles = require('../../constants/roles');
const { getSessionToken } = require('../../utils/session');

const getUser = async function(req) {
  const sessionToken = getSessionToken(req);
  if (!sessionToken) {
    return res.status(301).redirect('/');
  }

  const user = await db.select('*')
    .from('se_project.sessions')
    .where('token', sessionToken)
    .innerJoin('se_project.users', 'se_project.sessions.userid', 'se_project.users.id')
    .innerJoin('se_project.roles', 'se_project.users.roleid', 'se_project.roles.id')
    .first();
  
  console.log('user =>', user)
  user.isStudent = user.roleid === roles.student;
  user.isAdmin = user.roleid === roles.admin;
  user.isSenior = user.roleid === roles.senior;

  return user;  
}

module.exports = function(app) {
  // Register HTTP endpoint to render /users page
  app.get('/dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('dashboard', user);
  });
  
 // Register HTTP endpoint to render /users page
 app.get('/users', async function(req, res) {
  const users = await db.select('*').from('se_project.users');
  return res.render('users', { users });
});

  // Register HTTP endpoint to render /courses page
  app.get('/stations_example', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('stations_example', { ...user, stations });
  });


    // Register HTTP endpoint to render /courses page
  app.get('/manage/routes', async function(req, res) {
   try{ const user = await getUser(req);
    const routes = await db.select('*').from('se_project.routes');
    return res.render('manage_routes', {routes});
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
  });


  app.get('/resetPassword', async function(req, res) {
    try {
      const user = await getUser(req);
      return res.render('reset_password');
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
    
  }); 
  app.get('/manage/stations', async function(req, res) {
    try {
      const user = await getUser(req);
      const stations = await db.select('*').from('se_project.stations');
     
      return res.render('manage_station',{stations});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }

  });



  app.get('/subscriptions', async function(req, res) {
    try {
      const user = await getUser(req);
      const subsription = await db.select('*').from('se_project.subsription').where("userid", user.userid);
      return res.render('view_zones',{subsription});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
  });

  app.get('/tickets', async function(req, res) {
    const user = await getUser(req);
    const rides = await db.select('*').from('se_project.rides').where("userid", user.userid);
    return res.render('Tickets', { rides });
  });
  app.get('/requests/refund', async function(req, res) {
    const user = await getUser(req);
    const subsription = await db.select('*').from('se_project.subsription').where("userid", user.userid);
    return res.render('refund_request_send');
  });


};