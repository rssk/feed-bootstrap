//const npm = require('npm');
// const pigpio = require('pigpio');
const clarify = require('clarify');
const trace = require('trace');
const wifi = require('node-wifi');
const readFileSync = require('fs').readFileSync;
const writeFileSync = require('fs').writeFileSync;
const join = require('path').join;

process.on('uncaughtException', (error) => {
  logError(error);
});

const logError = (error) => {
  try {
    writeFileSync(error, join(`/mnt/pnt`, `errors.txt`), 'w+');
    console.error(error);
  } catch (e) {
    console.error(`Failed to write out error to drive: ${e}`);
    writeFileSync(error, join(`~/`, `errors.txt`), 'w+');
  }
};
const setLightState = (state) => {
	pigpio(state); // flashing green
}


new Promise(function(resolve, reject) {
  setLightState('green', 'slowFlash');
  npm.load({ 'global': true }, function (err) {
    if (err) return reject(err);

    npm.commands.install(['feed-printer'], function (err, data) {
      if (err) return reject(err);
      const feedPrinter = require('feed-printer');
      resolve(data);
    });
  });
}).then((stuff) => {
  // ethernet too?
  let wifiSettings
  try {
   wifiSettings = JSON.parse(readFileSync(join(`/mnt/pnt`, `wifi.json`)));
  } catch (e) {
    wifiSettings = undefined;
  }
  if (wifiSettings) {
    return wifi.connect({ ssid: wifiSettings.ssid, password: wifiSettings.password });
  }
}).then(() => {
  setLightState('green', 'fastFlash');
  // start feed-printer
  let retries = 1;
  let execTime = Date.now();
  const keepItFed = () => {
    setLightState('green', 'steady');
    if (retries && retries < 500) {
      feedPrinter.start()
      .catch((error) => {
        if (execTime - Date.now() < 500) {
          retries = null;
        } else {
          execTime = Date.now();
          retries += 1;
        }
        log(error);
        keepItFed();
      });
    } else {
      setLightState('red', 'slowFlash');
      setLightState('green', 'off');
    }
  };
  keepItFed();
}).catch((error) => {
  setLightState('red', 'slowFlash');
  setLightState('green', 'off');
  logError(error);
})
