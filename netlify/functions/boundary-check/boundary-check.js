const axios = require("axios");
const {
  NOTEHUB_AUTH_TOKEN,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_SMS_TO,
  TWILIO_SMS_FROM,
} = process.env;
const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function pointIsInPoly(p, polygon) {
  var isInside = false;
  var minX = polygon[0].x,
    maxX = polygon[0].x;
  var minY = polygon[0].y,
    maxY = polygon[0].y;
  for (var n = 1; n < polygon.length; n++) {
    var q = polygon[n];
    minX = Math.min(q.x, minX);
    maxX = Math.max(q.x, maxX);
    minY = Math.min(q.y, minY);
    maxY = Math.max(q.y, maxY);
  }

  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return false;
  }

  var i = 0,
    j = polygon.length - 1;
  for (i, j; i < polygon.length; j = i++) {
    if (
      polygon[i].y > p.y != polygon[j].y > p.y &&
      p.x <
        ((polygon[j].x - polygon[i].x) * (p.y - polygon[i].y)) /
          (polygon[j].y - polygon[i].y) +
          polygon[i].x
    ) {
      isInside = !isInside;
    }
  }

  return isInside;
}

// Generate these using a tool like https://www.keene.edu/campus/maps/tool/.
/*
const coordinates = [
  { x: -84.6499372, y: 42.7666115 },
  { x: -84.6538854, y: 42.7663122 },
  { x: -84.6540141, y: 42.7623582 },
  { x: -84.6520615, y: 42.7609246 },
  { x: -84.6473622, y: 42.7611294 },
  { x: -84.6452594, y: 42.7637918 },
  { x: -84.6459675, y: 42.766391 },
  { x: -84.6499372, y: 42.7665328 },
  { x: -84.6499372, y: 42.7666115 },
];
*/

const coordinates = [
  {
    x: -72.2836876,
    y: 42.933867,
  },
  {
    x: -72.2832584,
    y: 42.9331758,
  },
  {
    x: -72.2836018,
    y: 42.9284626,
  },
  {
    x: -72.2750187,
    y: 42.9282112,
  },
  {
    x: -72.2750187,
    y: 42.93349,
  },
  {
    x: -72.2836876,
    y: 42.933867,
  },
];

const updateEnvVar = () => {
  const timestamp = String(new Date().getTime() / 1000);
  try {
    axios.put(
      "https://api.notefile.net/v1/projects/app:38591b70-4c0b-40f3-9e0c-c2c319eef1e3/devices/dev:868050040247765/environment_variables",
      {
        environment_variables: { last_notified: timestamp },
      },
      {
        headers: {
          "X-SESSION-TOKEN": NOTEHUB_AUTH_TOKEN,
        },
      }
    );
  } catch (e) {
    console.log("Failed to update Notehub environment variable");
    console.log(e);
  }
};

const sendTwilioSMS = (lat, lon) => {
  try {
    twilio.messages.create({
      body: `Your asset left its geofence. Current location: https://maps.google.com/maps?q=${lat},${lon}`,
      to: TWILIO_SMS_TO,
      from: TWILIO_SMS_FROM,
    });
  } catch (e) {
    console.log("Failed to send Twilio message.");
  }
};

// Docs on event and context https://www.netlify.com/docs/functions/#the-handler-method
const handler = async (event) => {
  let body;

  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 500, body: "Invalid JSON body" };
  }

  const lat = body.lat;
  const lon = body.lon;

  if (!lat || !lon) {
    return { statusCode: 500, body: "Invalid GPS coordinates" };
  }

  const isInGeofence = pointIsInPoly({ x: lon, y: lat }, coordinates);
  if (!isInGeofence) {
    updateEnvVar();
    sendTwilioSMS(lat, lon);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      isInGeofence: isInGeofence,
      lat: lat,
      lon: lon,
    }),
  };
};

module.exports = { handler };
