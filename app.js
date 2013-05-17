/*
 * Config
 */
var artnethost = '192.168.0.90';
var sessionsecret = 'vewwysecuwe';

/**
 * Module dependencies.
 */

var navLinks = {
  user: [ 
    { label: 'Lighting', key: 'lighting', path: '/lighting' }
  ],
  admin: [
    { label: 'Presets', key: 'presets', path: '/presets' },
    { label: 'Zones', key: 'zones', path: '/zones' },
    { label: 'Lights', key: 'lights', path: '/lights' }
  ],
}

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , flash = require('connect-flash')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , artnet = require('artnet-node').Client.createClient(artnethost, 6454)
  , async = require('async')
  , fs = require('fs')
  , path = require('path');

var app = express();
var server = http.createServer(app)
  , io = require('socket.io').listen(server)

io.set('log level', 1)

var users = [
    { id: 1, username: 'admin', password: 'secret', level: 2 }
  , { id: 2, username: 'guest', password: 'guest', level: 1 }
];

function findUserById(id, fn) {
  var idx = id - 1;
  if (users[idx]) {
    fn(null, users[idx]);
  } else {
    fn(new Error('User ' + id + ' does not exist'));
  }
}

function findUserByUsername(username, fn) {
  for (var i = 0, len = users.length; i < len; i++) {
    var user = users[i];
    if (user.username === username) {
      return fn(null, user);
    }
  }
  return fn(null, null);
}

passport.use(new LocalStrategy(
  function(username, password, done) {
    process.nextTick(function () {
      // Find the user by username.  If there is no user with the given
      // username, or the password is not correct, set the user to `false` to
      // indicate failure.  Otherwise, return the authenticated `user`.
      findUserByUsername(username, function(err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false, { message: 'Incorrect user' }); }
        if (user.password != password) { return done(null, false, { message: 'Incorrect password' }); }
        return done(null, user);
      })
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  findUserById(id, function (err, user) {
    done(err, user);
  });
});

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.compress());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({
  secret: sessionsecret
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req,res,next) {
  res.locals.lighting = function(data) { return lighting.data; }
  next();
});
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.locals.navLinks = navLinks;

app.get('/', routes.index);
app.get('/lighting', routes.lighting);
app.get('/presets', ensureAuthenticated, routes.presets);
app.get('/zones', ensureAuthenticated, routes.zones);
app.get('/lights', ensureAuthenticated, routes.lights);
app.get('/login', routes.login);

app.post('/login',
  passport.authenticate('local', { successReturnToOrRedirect: '/',
                                   failureRedirect: '/login',
                                   failureFlash: true })
);

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
      res.redirect('/login')
}

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

/*
 * Initialise files
 */
var lightingDB = "lighting.json";
var lighting = {};
/*
var lighting["output"] = [];
var lighting["brightness"] = 0;
var lighting["preset"] = 0;
var lighting["lights"] = [];
var lighting["presets"] = [];
var lighting["zones"] = [];
*/
fs.exists(lightingDB, function (exists) {
  if (exists) {
    fs.readFile(lightingDB, function (err, data) {
      if (err) throw err;
      lighting = JSON.parse(data);
    })
  } else {
    lighting["output"] = new Array(512);
    for (var i = 0; i < 512; i++) {
      lighting["output"][i] = 0;
    }
    lighting["brightness"] = 0;
    lighting["preset"] = 0;
    lighting["lights"] = [];
    lighting["presets"] = new Array(9);
    for (var i = 0; i < lighting["presets"].length; i++) {
      lighting["presets"][i] = {
        "name": "Undefined",
        "description": "Undefined",
        "values": new Array(512)
      }
      for (var j = 0; j < lighting["presets"][i]["values"].length; j++) {
        lighting["presets"][i]["values"][j] = 0
      }
    }
    lighting["zones"] = [];
    fs.writeFile(lightingDB, JSON.stringify(lighting));
  }
})

updateLights = function() {
  var tmp = [];
  for (var i = 0; i < 512; i++) {
    tmp[i] = parseInt(lighting["output"][i] * lighting["brightness"] / 100)
  }
  artnet.send(tmp);
}

sendLightingZones = function(socket, data) {
  socket.broadcast.emit('emitZones', data["zones"]);
}
/*
 * Socket events
 */
io.sockets.on('connection', function (socket) {

  /*
   * Send current settings to new connection..
   */
  socket.emit('emitBrightness', lighting["brightness"])
  socket.emit('emitPreset', lighting["preset"])
  socket.emit('emitPresets', lighting["presets"])
  socket.emit('emitZones', lighting["zones"])
  socket.emit('emitLights', lighting["lights"])

  /*
   * ..then update on events
   */
  socket.on('setBrightness', function(data) {
    var brightness = parseInt(data);
    lighting["brightness"] = brightness;
    updateLights();
    fs.writeFile(lightingDB, JSON.stringify(lighting));
    socket.broadcast.emit('emitBrightness', lighting["brightness"]);
  })
  socket.on('setPreset', function(data) {
    var preset = parseInt(data);
    lighting["preset"] = preset;
    for (var i = 0; i < 512; i++) {
      lighting["output"][i] = lighting["presets"][preset]["values"][i]
    }
    updateLights();
    fs.writeFile(lightingDB, JSON.stringify(lighting));
    socket.broadcast.emit('emitPreset', lighting["preset"]);
  })
  socket.on('setZoneColour', function(data) {
    var zoneid = data.zoneid;
    var colour = data.colour;
    lighting["zones"][zoneid]["colour"] = colour;
    /*
     * XXX: abstract away
     */
    var r = parseInt(colour.slice(1,3), 16);
    var g = parseInt(colour.slice(3,5), 16);
    var b = parseInt(colour.slice(5,7), 16);
    lighting["zones"][zoneid]["lights"].forEach(function(light) {
      var offset = parseInt(light - 1);
      switch (lighting["lights"][offset]["type"]) {
      case 'rf':
        lighting["output"][offset] = r;
        lighting["output"][offset+1] = g;
        lighting["output"][offset+2] = b;
        lighting["output"][offset+3] = 255; /* XXX: unsupported */
        break;
      case 'r':
        lighting["output"][offset] = r;
        lighting["output"][offset+1] = g;
        lighting["output"][offset+2] = b;
        break;
      }
    });
    updateLights();
    fs.writeFile(lightingDB, JSON.stringify(lighting));
    socket.broadcast.emit('emitZones', lighting["zones"]);
  });
})

/*
 * API
 */
app.get('/api', function (req, res) {
  res.send(200, [
    'GET      /api',
    'GET      /api/lighting/output',
    'POST     /api/lighting/output',
    'GET      /api/lighting/lights',
    'POST     /api/lighting/lights',
    'GET      /api/lighting/light/:id',
    'PUT      /api/lighting/light/:id',
    'DELETE   /api/lighting/light/:id',
    'GET      /api/lighting/presets',
    'POST     /api/lighting/presets',
    'GET      /api/lighting/preset/:id',
    'PUT      /api/lighting/preset/:id',
    'DELETE   /api/lighting/preset/:id',
    'GET      /api/lighting/zones',
    'POST     /api/lighting/zones',
    'GET      /api/lighting/zone/:id',
    'PUT      /api/lighting/zone/:id',
    'DELETE   /api/lighting/zone/:id',
    ]);
});

app.get('/api/lighting/output', function (req, res) {
  res.send(lighting["output"]);
})
app.post('/api/lighting/output', function (req, res) {
  var vals = req.body;
  for (var i = 0; i < 512; i++) {
    if (vals[i]) {
      lighting["output"][i] = vals[i]
    }
  }
  updateLights();
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(lighting["output"]);
})
app.get('/api/lighting/lights', function (req, res) {
  res.send(lighting["lights"]);
})
app.post('/api/lighting/lights', function (req, res) {
  var light = {
    address: req.body.address,
    description: req.body.description || '',
    type: req.body.type
  };
  var offset = parseInt(light["address"] - 1)
  if (light["type"] == "rgbf") {
    lighting["lights"][offset] = {'type': 'rf', 'description': light["description"]};
    lighting["lights"][offset+1] = {'type': 'g'};
    lighting["lights"][offset+2] = {'type': 'b'};
    lighting["lights"][offset+3] = {'type': 'f'};
  } else if (light["type"] == "rgb") {
    lighting["lights"][offset] = {'type': 'r', 'description': light["description"]};
    lighting["lights"][offset+1] = {'type': 'g'};
    lighting["lights"][offset+2] = {'type': 'b'};
  } else {
    lighting["lights"][offset] = {'type': 'w', 'description': light["description"]}
  }
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(201, light);
  io.sockets.emit('emitLights', lighting["lights"]);
});
app.get('/api/lighting/light/:id', function (req, res) {
  var offset = parseInt(req.params.id - 1)
  if (lighting["lights"][offset]) {
    res.json(lighting["lights"][offset]);
  } else {
    var errmsg = {"code": "ResourceNotFound", "message": "light does not exist"}
    res.send(404, errmsg)
  }
})
app.put('/api/lighting/light/:id', function (req, res) {
  var light = {
    id: req.params.id,
    colour: req.body.colour,
    zone: req.body.zone,
  };
  var offset = parseInt(light.id - 1)
  lighting["lights"][offset] = light;
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(204);
})
app.del('/api/lighting/light/:id', function (req, res) {
  var addr = parseInt(req.params.id)
  if (lighting["lights"][addr]["type"] === "rf") {
    delete lighting["lights"][addr]
    delete lighting["lights"][addr+1]
    delete lighting["lights"][addr+2]
    delete lighting["lights"][addr+3]
  } else if (lighting["lights"][addr]["type"] === "r") {
    delete lighting["lights"][addr]
    delete lighting["lights"][addr+1]
    delete lighting["lights"][addr+2]
  } else if (lighting["lights"][addr]["type"] === "w") {
    delete lighting["lights"][addr]
  }
  res.send(204);
  io.sockets.emit('emitLights', lighting["lights"])
})
/*
 * Preset routing
 */
app.get('/api/lighting/presets', function (req, res) {
  res.send(lighting["presets"]);
})
app.get('/api/lighting/preset/:id', function (req, res) {
  var id = parseInt(req.params.id)
  if (lighting["presets"][id]) {
    res.json(lighting["presets"][id]);
  } else {
    var errmsg = {"code": "ResourceNotFound", "message": "preset " + id + " does not exist"}
    res.send(404, errmsg)
  }
})
app.put('/api/lighting/preset/:id', function (req, res) {
  var preset = {
    id: req.params.id,
    name: req.body.name,
    description: req.body.description,
    save: req.body.save
  };
  if (preset.name) {
    lighting["presets"][preset.id]["name"] = preset.name
  }
  if (preset.description) {
    lighting["presets"][preset.id]["description"] = preset.description
  }
  if (preset.save) {
    for (var i = 0; i < 512; i++) {
      lighting["presets"][preset.id]["values"][i] = lighting["output"][i]
    }
  }
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(204);
  io.sockets.emit('emitPresets', lighting["presets"]);
})
/*
 * Zones routing
 */
app.get('/api/lighting/zones', function (req, res) {
  res.send(lighting["zones"]);
})
app.post('/api/lighting/zones', function (req, res) {
  var id = lighting["zones"].length + 1;
  var zone = {
    id: id,
    name: req.body.name || 'Unnamed',
    description: req.body.description || '',
    colour: req.body.colour || '000000',
    lights: req.body.lights || [],
  };
  lighting["zones"].push(zone);
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(201, zone);
  io.sockets.emit('emitZones', lighting["zones"]);
});
app.put('/api/lighting/zones/:id', function (req, res) {
  var zone = {
    id: req.params.id,
    name: req.body.name,
    description: req.body.description,
    colour: req.body.colour,
    lights: req.body.lights
  };
  if (zone.name) {
    lighting["zones"][zone.id]["name"] = zone.name
  }
  if (zone.description) {
    lighting["zones"][zone.id]["description"] = zone.description
  }
  if (zone.colour) {
    lighting["zones"][zone.id]["colour"] = zone.colour
  }
  if (zone.lights) {
    lighting["zones"][zone.id]["lights"] = zone.lights
  }
  fs.writeFile(lightingDB, JSON.stringify(lighting));
  res.send(204);
  io.sockets.emit('emitZones', lighting["zones"]);
})

//app.get('/api/zones/:name', zones.view)
//app.get('/api/zone/:id/view', zones.view)
//app.get('/api/zone/:id/edit', zones.edit)
//app.put('/api/zone/:id/edit', zones.update)

