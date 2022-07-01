const axios = require("axios");
const coordinates = require("../../../geofence").coordinates;
const {
  NOTEHUB_AUTH_TOKEN,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_SMS_TO,
  TWILIO_SMS_FROM,
} = process.env;
const twilio = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// From https://stackoverflow.com/a/17490923/1373932
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

const updateEnvVar = () => {
  const timestamp = String(new Date().getTime() / 1000);
  return new Promise((resolve, reject) => {
    console.log("Updating last notified timestamp in Notehub", timestamp);
    axios
      .put(
        "https://api.notefile.net/v1/projects/app:38591b70-4c0b-40f3-9e0c-c2c319eef1e3/devices/dev:868050040247765/environment_variables",
        {
          environment_variables: { last_notified: timestamp },
        },
        {
          headers: {
            "X-SESSION-TOKEN": NOTEHUB_AUTH_TOKEN,
          },
        }
      )
      .then(() => {
        console.log("Last notified timestamp updated successfully");
        resolve();
      })
      .catch((e) => {
        console.error("Failed to update Notehub environment variable", e);
        reject();
      });
  });
};

const sendTwilioSMS = (lat, lon) => {
  return new Promise((resolve, reject) => {
    console.log("Sending Twilio SMS notification");
    twilio.messages
      .create({
        body: `Your asset left its geofence. Current location: https://maps.google.com/maps?q=${lat},${lon}`,
        to: TWILIO_SMS_TO,
        from: TWILIO_SMS_FROM,
      })
      .then(() => {
        console.log("SMS message sent successfully");
        resolve();
      })
      .catch((e) => {
        console.error("SMS message send failed", e);
        reject();
      });
  });
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

  console.log(`Received request for ${lat}, ${lon}`);

  const isInGeofence = pointIsInPoly({ x: lon, y: lat }, coordinates);
  if (!isInGeofence) {
    try {
      await updateEnvVar();
    } catch (e) {
      return { statusCode: 500, body: "Failed while updating Notehub" };
    }
    try {
      await sendTwilioSMS(lat, lon);
    } catch (e) {
      return { statusCode: 500, body: "Failed while sending SMS notification" };
    }
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
