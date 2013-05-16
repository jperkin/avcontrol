
/*
 * GET home page.
 */

exports.index = function(req, res){
  console.log(req);
  res.render('index', { user: req.user, title: 'Control Central', section: 'index'});
};

exports.login = function(req, res){
  res.render('login', { user: req.user, title: 'Login', section: 'login'});
};

exports.lighting = function(req, res){
  res.render('lighting', { user: req.user, title: 'Lighting Control', section: 'lighting'});
};

exports.presets = function(req, res){
  res.render('presets', { user: req.user, title: 'Presets', section: 'presets'});
};

exports.zones = function(req, res){
  res.render('zones', { user: req.user, title: 'Zones', section: 'zones'});
};

exports.lights = function(req, res){
  res.render('lights', { user: req.user, title: 'Lights', section: 'lights'});
};