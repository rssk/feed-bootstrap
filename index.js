const npm = require('npm');
const Gpio = require('pigpio').Gpio;
const clarify = require('clarify');
const trace = require('trace');
const wifi = require('node-wifi');
const readFileSync = require('fs').readFileSync;
const writeFileSync = require('fs').writeFileSync;
const join = require('path').join;
debugger;

const errorled = new Gpio(20, {mode: Gpio.OUTPUT});
const statusled = new Gpio(21, {mode: Gpio.OUTPUT});

const logError = (error) => {
  try {
    writeFileSync(join('/media/pi/BB', 'errors.txt'), error, { flag: 'a' });
    console.error(error);
  } catch (e) {
    console.error(`Failed to write out error to drive: ${e}`);
    writeFileSync(join('/home/pi', 'errors.txt'), error, { flag: 'a' });
  }
};

process.on('uncaughtException', (error) => {
  logError(error);
});

let currentInterval;
const setLightState = (led, state) => {
  const flash = (speed) => {
    let dutyCycle = 0;
    if (currentInterval) clearInterval(currentInterval);
    currentInterval = setInterval(() => {
      led.pwmWrite(dutyCycle);

      if (dutyCycle === 0) {
        dutyCycle = 255;
      } else {
        dutyCycle = 0
      }
    }, speed);
  }

  switch(state) {
    case 'slowFlash':
      flash(500)
    case 'fastflash':
      flash(200)
    case 'on':
      if (currentInterval) clearInterval(currentInterval);
      led.pwmWrite(255);
    case 'off':
      if (currentInterval) clearInterval(currentInterval);
      led.pwmWrite(0);
    default:
  }
};

setLightState(statusled, 'slowFlash');
debugger
let settings;
let prom = Promise.resolve();
settings = JSON.parse(readFileSync(join('/media/pi/BB', 'settings.json')));
if (settings.wifi) {
  wifi.init({ iface: 'wlan0' });
  debugger;
  prom = wifi.disconnect()
    .catch(() => {})
    .then(() => wifi.deleteConnection({ ssid: settings.wifi.ssid }))
    .catch(() => {})
    .then(() => wifi.scan())
    .then((networks) => {
    debugger;
  }).then(() => wifi.connect({ ssid: settings.wifi.ssid, password: settings.wifi.password }));
}
prom.then((stuff) => {
  return new Promise(function (resolve, reject) {
    setLightState(statusled, 'slowFlash');
    debugger;
    npm.load({ loaded: false }, function (err) {
      if (err) return reject(err);

      npm.commands.install(['feed-printer'], function (err, data) {
        debugger;
        if (err) return reject(err);
        // const feedPrinter = require('feed-printer');
        resolve(data);
      });
    });
  });
}).then(() => {
  debugger;
  setLightState(statusled, 'fastFlash');
  // start feed-printer
  let retries = 1;
  let execTime = Date.now();
  const keepItFed = () => {
    setLightState(statusled, 'on');
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
      setLightState(errorled, 'slowFlash');
      setLightState(statusled, 'off');
    }
  };
  keepItFed();
}).catch((error) => {
  debugger;
  setLightState(errorled, 'slowFlash');
  setLightState(statusled, 'off');
  logError(error);
});
