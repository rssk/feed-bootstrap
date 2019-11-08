require('clarify');
require('trace');
const Gpio = require('pigpio').Gpio;
const wifi = require('node-wifi');
const readFileSync = require('fs').readFileSync;
const writeFileSync = require('fs').writeFileSync;
const join = require('path').join;
const { spawn } = require('child_process');
const pify = require('util').promisify;
const rimraf = pify(require('rimraf'));

const errorled = new Gpio(20, { mode: Gpio.OUTPUT });
const statusled = new Gpio(21, { mode: Gpio.OUTPUT });
const stickPath = '/media/pi/BB';
const logError = (error) => {
  try {
    writeFileSync(join(stickPath, 'errors.txt'), error, { flag: 'a' });
    console.error(error);
  } catch (e) {
    console.error(`Failed to write out error to drive: ${e}`);
    writeFileSync(join('/home/pi', 'errors.txt'), error, { flag: 'a' });
  }
};

process.on('uncaughtException', (error) => {
  setLightState(errorled, 'slowFlash');
  setLightState(statusled, 'off');
  logError(error);
});

const currentInterval = {};
const setLightState = (led, state) => {
  const flash = (speed) => {
    let dutyCycle = 0;
    if (currentInterval[led]) clearInterval(currentInterval[led]);
    currentInterval[led] = setInterval(() => {
      led.pwmWrite(dutyCycle);

      if (dutyCycle === 0) {
        dutyCycle = 255;
      } else {
        dutyCycle = 0;
      }
    }, speed);
  };

  switch (state) {
    case 'slowFlash':
      flash(500);
      break;
    case 'fastFlash':
      flash(200);
      break;
    case 'on':
      if (currentInterval) clearInterval(currentInterval);
      led.pwmWrite(255);
      break;
    case 'off':
      if (currentInterval) clearInterval(currentInterval);
      led.pwmWrite(0);
      break;
    default:
  }
};
let feedPrinter;
setLightState(statusled, 'slowFlash');
let prom = Promise.resolve();
const settings = JSON.parse(readFileSync(join(stickPath, 'settings.json')));
if (settings.wifi) {
  wifi.init({ iface: 'wlan0' });
  prom = wifi.disconnect()
    .catch(() => {})
    .then(() => wifi.deleteConnection({ ssid: settings.wifi.ssid }))
    .catch(() => {})
    .then(() => wifi.scan())
    .then(() => wifi.connect({ ssid: settings.wifi.ssid, password: settings.wifi.password }));
}
prom.then((stuff) => {
  setLightState(statusled, 'fastFlash');
  // root uid update only works on plain install
  // delete hack to make update work
  return rimraf(join('.', 'node_modules', 'feed-printer'))
    .then(() => {
      return new Promise(function (resolve, reject) {
        const npmu = spawn('npm', ['--unsafe-perm', 'install']);
        npmu.stdout.on('data', (data) => {
          console.log(`${data}`);
        });
        let errMsg = '';
        npmu.stderr.on('data', (data) => {
          errMsg += data;
        });

        npmu.on('close', (code) => {
          if (code > 0) return reject(new Error(`Self update failed with code ${code}: ${errMsg}`));
          resolve();
        });
      });
    });
}).then(() => {
  feedPrinter = require('feed-printer');
}).then(() => {
  // start feed-printer
  let retries = 1;
  let execTime = Date.now();
  const keepItFed = () => {
    setLightState(statusled, 'on');
    feedPrinter.saveEmitter.on('saving', setLightState.bind(null, errorled, 'on'));
    feedPrinter.saveEmitter.on('saved', setLightState.bind(null, errorled, 'off'));
    if (retries && retries < 500) {
      feedPrinter.start(join(stickPath, 'articlesdb.json', settings.printing))
        .catch((error) => {
          if (execTime - Date.now() < 500) {
            retries = null;
          } else {
            execTime = Date.now();
            retries += 1;
          }
          logError(error);
          keepItFed();
        });
    } else {
      setLightState(errorled, 'slowFlash');
      setLightState(statusled, 'off');
    }
  };
  keepItFed();
}).catch((error) => {
  setLightState(errorled, 'slowFlash');
  setLightState(statusled, 'off');
  logError(error);
});
