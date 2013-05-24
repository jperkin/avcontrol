/**
 * Module dependencies.
 */

var navLinks = {
  user: [ 
    { label: 'Lighting', key: 'lighting', path: '/lighting' },
    { label: 'Power', key: 'power', path: '/power' }
  ],
  admin: [
    { label: 'Presets', key: 'presets', path: '/presets' },
    { label: 'Zones', key: 'zones', path: '/zones' },
    { label: 'Lights', key: 'lights', path: '/lights' },
    { label: 'Switches', key: 'switches', path: '/switches' }
  ],
}

var config = require('./config');
var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , flash = require('connect-flash')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , artnet = require('artnet-node').Client.createClient(config.artnethost, 6454)
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
  secret: config.sessionsecret
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
app.get('/power', routes.power);
app.get('/presets', ensureAuthenticated, routes.presets);
app.get('/zones', ensureAuthenticated, routes.zones);
app.get('/lights', ensureAuthenticated, routes.lights);
app.get('/switches', ensureAuthenticated, routes.switches);
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
var saveLighting = 0;
var updateLighting = 0;
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

/*
 * Check for lighting updates every 5 seconds and flush to disk on change.
 */
setInterval(function() {
  if (saveLighting) {
    saveLighting = 0;
    fs.writeFile(lightingDB, JSON.stringify(lighting));
  }
}, 5000);
saveLights = function() {
  saveLighting = 1;
}

/*
 * Send lighting updates on change, limited to 50Hz.
 */
var sendOutput = new Array(512);
setInterval(function() {
  if (updateLighting) {
    updateLighting = 0;
    for (var i = 0; i < sendOutput.length; i++) {
      /*
       * The brightness value for PAR8 lights should always be set full,
       * and we control them with the RGB values.  Yes, this is a hack.
       *
       * Otherwise we calculate the output as RGB * overall brightness.
       */
      if (lighting.lights[i] && lighting.lights[i].type === 'par8') {
        sendOutput[i] = parseInt(lighting["output"][i])
      } else {
        sendOutput[i] = parseInt(lighting["output"][i] * lighting["brightness"] / 100)
      }
    }
    artnet.send(sendOutput);
  }
}, 20);
updateLights = function() {
  updateLighting = 1;
}

var powerDB = "power.json";
var power = {};
fs.exists(powerDB, function (exists) {
  if (exists) {
    fs.readFile(powerDB, function (err, data) {
      if (err) {
        return console.log(err);
      }
      power = JSON.parse(data);
    })
  } else {
    power.switches = [];
    fs.writeFile(powerDB, JSON.stringify(power));
  }
})

/*
 * Set a power switch on/off via Z-Wave
 */
var setPowerSwitch = function (powsock)
{
  var psid = parseInt(powsock.id);

  /*
   * Z-Wave protocol packet
   */
  var packet = [
    0x06, // command terminator?  appear to require two
    0x06,
    0x01,
    0x0a,
    0x00,
    0x13,
    psid, // node id
    0x03,
    0x25, // COMMAND_CLASS_SWITCH_BINARY
    0x01,
    powsock.state === 'on' ? 0xff : 0x00,
    0x25, // transmit options (ACK | AUTO_ROUTE | EXPLORE)
    0x10, // packet length
  ]

  /*
   * Calculate and append packet checksum
   */
  var csum = 0xff;
  for (var i = 3; i < packet.length; i++) {
    csum ^= packet[i];
  }
  packet.push(csum);

  /*
   * Create buffer and send
   */
  var zwave = new Buffer(packet.length);
  packet.forEach(function (val, idx) {
    var hexval = parseInt(val).toString(16);
    zwave.write(hexval.length > 1 ? hexval : '0' + hexval, idx, 'hex');
  });

  fs.open('/dev/ttyUSB0', 'a', function (err, fd) {
    if (err) {
      return console.log(err);
    }
    fs.write(fd, zwave, 0, zwave.length, -1, function(err) {
      if (err) {
        return console.log(err);
      }
    })
  })
}

/*
 * Socket events
 */
io.sockets.on('connection', function (socket) {

  /*
   * Send current settings to new connection..
   */
  socket.emit('emitBrightness', lighting)
  socket.emit('emitPreset', lighting)
  socket.emit('emitPresets', lighting)
  socket.emit('emitZones', lighting)
  socket.emit('emitLights', lighting)
  socket.emit('emit-power-switches', power.switches)

  /*
   * ..then update on events
   */
  socket.on('setPowerSwitch', function(data) {
    power.switches[data.socket].state = data.state;
    updateSocket(sockets[data.socket]);
    fs.writeFile(powerDB, JSON.stringify(power.switches));
    socket.broadcast.emit('emit-power-switches', power.switches);
  });
  socket.on('setBrightness', function(data) {
    var brightness = parseInt(data);
    lighting["brightness"] = brightness;
    updateLights();
    saveLights();
    socket.broadcast.emit('emitBrightness', lighting);
  })
  socket.on('setPreset', function(data) {
    var preset = parseInt(data);
    lighting["preset"] = preset;
    for (var i = 0; i < 512; i++) {
      lighting["output"][i] = lighting["presets"][preset]["values"][i]
    }
    updateLights();
    /*
     * XXX: hack!
     */
    lighting.zones.forEach(function(zone, index) {
      if (zone === undefined || zone === null) {
        return;
      }
      if (zone.lights && zone.lights.length > 0) {
        var l = parseInt(zone.lights[0] - 1);
        var offset = 0;
        var col = '#';
        if (lighting.lights[l].type === 'par8') {
          offset = 1;
        }
        [0, 1, 2].forEach(function(i) {
          var d = parseInt(lighting.output[l + offset + i]).toString(16);
          if (d <= 9) {
            d = '0' + d;
          }
          col += d;
        });
        lighting.zones[index].colour = col;
      }
    });
    saveLights();
    socket.broadcast.emit('emitPreset', lighting);
    socket.broadcast.emit('emitZones', lighting);
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
      case 'par8':
        lighting["output"][offset] = 255; // Dimmer
        lighting["output"][offset+1] = r;
        lighting["output"][offset+2] = g;
        lighting["output"][offset+3] = b;
        lighting["output"][offset+4] = 0; // Flash speed
        lighting["output"][offset+5] = 0; // Gradient change speed
        lighting["output"][offset+6] = 0; // Jumping colour change speed
        lighting["output"][offset+7] = 0; // Control channels
        break;
      case 'rgb':
        lighting["output"][offset] = r;
        lighting["output"][offset+1] = g;
        lighting["output"][offset+2] = b;
        break;
      }
    });
    updateLights();
    saveLights();
    socket.broadcast.emit('emitZones', lighting);
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

/*
 * Power API
 */
app.get('/api/power/switches', function (req, res) {
  var out = []
  power.switches.forEach(function(s, idx) {
    if (power.switches[idx] && power.switches[idx].id) {
      out.push(power.switches[idx]);
    }
  });
  res.send(out);
});
app.post('/api/power/switches', function (req, res) {
  var ps = {
    address: req.body.address,
    description: req.body.description || ''
  };
  power.switches[ps.address] = {
    id: ps.address,
    description: ps.description,
    state: 'off'
  }
  res.send(201, ps);
  io.sockets.emit('emit-power-switches', power.switches);
  fs.writeFile(powerDB, JSON.stringify(power.switches));
});
app.get('/api/power/switch/:id', function (req, res) {
  if (power.switches[req.params.id]) {
    res.json(power.switches[req.params.id]);
  } else {
    var errmsg = {"code": "ResourceNotFound", "message": "socket does not exist"}
    res.send(404, errmsg)
  }
})
app.put('/api/power/switch/:id', function (req, res) {
  var ps = {
    id: req.params.id,
    description: req.body.description,
    state: req.body.state
  };
  if (ps.id) {
    power.switches[ps.id].id = ps.id;
  }
  if (ps.description) {
    power.switches[ps.id].description = ps.description
  }
  if (ps.state) {
    power.switches[ps.id].state = ps.state;
    setPowerSwitch(power.switches[ps.id]);
  }
  res.send(204);
  fs.writeFile(powerDB, JSON.stringify(power));
  io.sockets.emit('emit-power-switches', power.switches);
})
app.del('/api/power/switch/:id', function (req, res) {
  if (power.switches[req.params.id]) {
    delete power.switches[req.params.id]
  }
  res.send(204);
  io.sockets.emit('emit-power-switches', power.switches)
  fs.writeFile(powerDB, JSON.stringify(power.switches));
})

/*
 * Lighting API
 */
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
  saveLights();
  res.send(lighting["output"]);
})
app.get('/api/lighting/lights', function (req, res) {
  res.send(lighting["lights"]);
})
app.post('/api/lighting/lights', function (req, res) {
  var light = {
    address: req.body.address,
    description: req.body.description || '',
    type: req.body.type || 'single'
  };
  var offset = parseInt(light["address"] - 1)
  switch (light.type) {
  case 'par8':
    lighting["lights"][offset] = {'type': 'par8', 'description': light.description};
    lighting["lights"][offset+1] = {};
    lighting["lights"][offset+2] = {};
    lighting["lights"][offset+3] = {};
    lighting["lights"][offset+4] = {};
    lighting["lights"][offset+5] = {};
    lighting["lights"][offset+6] = {};
    lighting["lights"][offset+7] = {};
    break;
  case 'rgb':
    lighting["lights"][offset] = {'type': 'rgb', 'description': light.description};
    lighting["lights"][offset+1] = {};
    lighting["lights"][offset+2] = {};
    break;
  case 'single':
    lighting["lights"][offset] = {'type': 'single', 'description': light.description};
    break;
  }
  saveLights();
  res.send(201, light);
  io.sockets.emit('emitLights', lighting);
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
  saveLights();
  res.send(204);
})
app.del('/api/lighting/light/:id', function (req, res) {
  var addr = parseInt(req.params.id)
  switch (lighting["lights"][addr]["type"]) {
  case 'single':
    delete lighting["lights"][addr]
    break;
  case 'rgb':
    delete lighting["lights"][addr]
    delete lighting["lights"][addr+1]
    delete lighting["lights"][addr+2]
    break;
  case 'par8':
    delete lighting["lights"][addr]
    delete lighting["lights"][addr+1]
    delete lighting["lights"][addr+2]
    delete lighting["lights"][addr+3]
    delete lighting["lights"][addr+4]
    delete lighting["lights"][addr+5]
    delete lighting["lights"][addr+6]
    delete lighting["lights"][addr+7]
    break;
  }
  saveLights();
  res.send(204);
  io.sockets.emit('emitLights', lighting)
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
  saveLights();
  res.send(204);
  io.sockets.emit('emitPresets', lighting);
})
/*
 * Zones routing
 */
app.get('/api/lighting/zones', function (req, res) {
  res.send(lighting["zones"]);
})
app.post('/api/lighting/zones', function (req, res) {
  var id = lighting.zones.length + 1;
  for (var i = 0; i < lighting.zones.length; i++) {
    if (lighting.zones[i] === undefined || lighting.zones[i] === null) {
      id = i + 1;
      break;
    }
  }
  var zone = {
    id: id,
    name: req.body.name || 'Unnamed',
    description: req.body.description || '',
    colour: req.body.colour || '#000000',
    lights: req.body.lights || [],
  };
  if (id > lighting.zones.length) {
    lighting["zones"].push(zone);
  } else {
    lighting["zones"][id - 1] = zone;
  }
  saveLights();
  res.send(201, zone);
  io.sockets.emit('emitZones', lighting);
});
app.put('/api/lighting/zone/:id', function (req, res) {
  var zone = {
    id: req.params.id,
    name: req.body.name,
    description: req.body.description,
    colour: req.body.colour,
    lights: req.body.lights
  };
  var addr = parseInt(zone.id - 1);
  if (zone.name) {
    lighting["zones"][addr]["name"] = zone.name
  }
  if (zone.description) {
    lighting["zones"][addr]["description"] = zone.description
  }
  if (zone.colour) {
    lighting["zones"][addr]["colour"] = zone.colour
  }
  if (zone.lights) {
    lighting["zones"][addr]["lights"] = zone.lights
  }
  saveLights();
  res.send(204);
  io.sockets.emit('emitZones', lighting);
})
app.del('/api/lighting/zone/:id', function (req, res) {
  var zoneid = parseInt(req.params.id - 1)
  delete lighting["zones"][zoneid]
  saveLights();
  res.send(204);
  io.sockets.emit('emitZones', lighting);
})

//app.get('/api/zones/:name', zones.view)
//app.get('/api/zone/:id/view', zones.view)
//app.get('/api/zone/:id/edit', zones.edit)
//app.put('/api/zone/:id/edit', zones.update)

