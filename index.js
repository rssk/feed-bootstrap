//const npm = require('npm');
const pigpio = require('pigpio');
const nodeWifi = require('node-wifi');


const setLightState = (state) => {
  pigpio(state);
}


npm.load({ 'global': true }, function (err) {
    if (err) console.log(err);

    npm.commands.install(['feed-printer'], function (err, data) {
        if (err) return console.error(err)
    });
});
