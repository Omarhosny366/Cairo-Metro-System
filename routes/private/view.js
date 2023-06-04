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
    const role = await db.select('roleid').from('se_project.users').where("id",user.userid);
    if(user.role=='admin')
    return res.render('admin_dashboard', user);
    else
    return res.render('dashboard', user);
  });
  app.get('/admin_dashboard', async function(req, res) {
    const user = await getUser(req);
    return res.render('admin_dashboard', user);
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
    const s='new';
    const newstations = await db.select('*').from('se_project.stations').where("stationstatus",s);
    const allstations = await db.select('*').from('se_project.stations');
    return res.render('manage_routes', {routes,newstations,allstations});
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
  });


// Register HTTP endpoint to render /courses page
app.get('/manage/requests/senior', async function(req, res) {
  try{ const user = await getUser(req);
    const requests = await db.select('*').from('se_project.senior_requests').where("userid", user.userid);
    return res.render('manage_requests_senior', {requests});
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
      return res.render('viewsub',{subsription});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
  });



  app.get('/subscriptions/purchase', async function(req, res) {
    try {
      const user = await getUser(req);
      const subsription = await db.select('*').from('se_project.subsription').where("userid", user.userid);
      return res.render('view_zones',{subsription});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
  });

  app.get('/tickets/purchase', async function(req, res) {
    const user = await getUser(req);
    const rides = await db.select('*').from('se_project.rides').where("userid", user.userid);
    return res.render('Tickets', { rides });
  });
  app.get('/tickets', async function(req, res) {
    const user = await getUser(req);
    const tickets = await db.select('*').from('se_project.tickets').where("userid", user.userid);
    return res.render('make_refund_request',{tickets});
  });
  app.get('/senior/request', async function(req, res) {
    const user = await getUser(req);
    const subsription = await db.select('*').from('se_project.subsription').where("userid", user.userid);
    return res.render('senior_request');
  });


  app.get('/manage/requests/refunds', async function(req, res) {
    try {
      const user = await getUser(req);
      const request = await db.select('*').from('se_project.refund_requests');
      return res.render('Manage_requests_refunds',{request});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
 
  });
  app.get('/prices', async function(req, res) {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    return res.render('checkprice',{stations});
  });
  
  app.get('/manage/zones', async function(req, res) {
    try {
      const user = await getUser(req);
      const zones =await db.select('*').from('se_project.zones');
      return res.render('manage_price',{zones});
    } catch (e) {
      console.log(e.message);
      return res.status(500).send('Internal server error');
    }
});


app.get('/resetpasswordAdmin', async function(req, res) {
  try {
    const user = await getUser(req);
    return res.render('resetpasswordAdmin');
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
});
app.get('/rides/simulate', async function(req, res) {
  try {
    const user = await getUser(req);
    const stations = await db.select('*').from('se_project.stations');
    const rides = await db.select('*').from('se_project.rides').where("userid", user.userid);

    return res.render('simulate',{stations,rides});
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
  
});
app.get('/rides', async function(req, res) {
  try {
    const user = await getUser(req);
  
    const rides = await db.select('*').from('se_project.rides').where("userid", user.userid);

    return res.render('viewrides',{rides});
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
  
});
app.get('/requests/refund', async function(req, res) {
  try {
    const user = await getUser(req);
    const refund = await db.select('*').from('se_project.refund_requests').where("userid", user.userid);
    return res.render('view_refund',{refund});
  } catch (e) {
    console.log(e.message);
    return res.status(500).send('Internal server error');
  }
  
});
};