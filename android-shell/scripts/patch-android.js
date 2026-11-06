// Runs after `npx cap add android`: permissions, version, icons.
const fs = require('fs'), path = require('path');
const build = Number(process.argv[2] || 1);
const app = path.join(__dirname, '..', 'android', 'app');
const manifestPath = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let m = fs.readFileSync(manifestPath, 'utf8');
const perms = [
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
].filter(p => !m.includes(p.match(/name="([^"]+)"/)[1] + '"'));
m = m.replace('<application', perms.join('\n    ') + '\n\n    <application');
fs.writeFileSync(manifestPath, m);

const gradlePath = path.join(app, 'build.gradle');
let g = fs.readFileSync(gradlePath, 'utf8');
g = g.replace(/versionCode \d+/, 'versionCode ' + build).replace(/versionName "[^"]*"/, 'versionName "1.0.' + build + '"');
fs.writeFileSync(gradlePath, g);

// Copy icons (launcher, adaptive foreground, notification badge) over the template.
const src = path.join(__dirname, '..', 'res'), dst = path.join(app, 'src', 'main', 'res');
fs.cpSync(src, dst, { recursive: true, force: true });
console.log('patched: build', build, '| permissions added:', perms.length);
