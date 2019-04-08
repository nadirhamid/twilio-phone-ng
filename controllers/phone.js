const twilio = require('twilio')
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const got = require('got');
const Call = require('.././models/call.js')

module.exports.incoming = function (req, res) {
  if (!req.body.To || req.body.To.length === 0) {
    res.status(500).end()
    return
  }

  console.log('number to call: %s', req.body.To)

  let twiml = new VoiceResponse()
  client.calls.create({
         url: '/api/conference/added',
         to: "client:"+req.user.configuration.twilio.clientName,
         from: from
   });
  const dial = twiml.dial({
    "timeLimit": 30,
    "action":"/api/conference/action"
  });

  /*
  dial.client(
    {
      statusCallbackEvent: 'ringing answered completed',
      statusCallbackMethod: 'POST',
      statusCallback: req.user.getTrackerUrl(req),
    }, req.user.configuration.twilio.clientName)
  */
  dial.conference("main");

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
}

module.exports.outgoing = function (req, res) {
  let twiml = new VoiceResponse()

  const dial = twiml.dial( { callerId: req.user.getCallerId() });
  const from = req.body.From;
  client.calls.create({
         url: '/api/conference/added',
         to: req.body.PhoneNumber,
         from: from
   });

  /*
  dial.number({
    statusCallbackEvent: 'ringing answered completed',
    statusCallbackMethod: 'POST',
    statusCallback: req.user.getTrackerUrl(req),
  }, req.body.PhoneNumber)
  */
  dial.conference("main");

  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
}

module.exports.add = function (req, res) {
  var number = req.body.number;
  var from = req.body.from;
  var time = 30;
  function waitForCall(call) {
    var elapsed = 0;
    setInterval(function() {
      var beforeReq = Date.now();
      client.calls('CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
            .fetch()
            .then(function(call) { 
              console.log(call.to);
              var afterReq = Date.now();
              if (call.status == "in-progress") {
                res.json({"message": "call answered", "success": true});
                return;
              }
              elapsed = (afterReq-beforeReq);
              if (elapsed > time) { 
                res.json({"message": "timed out", "success": false});
              }
            }); 
    }, 1000);
  }
  const params = {
     url: '/api/conference/added',
     to: number,
     from: from
  };

  client.calls.create(params).then(function(call) {
        waitForCall(call);
  });
      

  
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
}

module.exports.added = function (req, res) {
  let twiml = new VoiceResponse();
  let dial = twiml.dial();
  dial.conference("man");
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
};

module.exports.action = function (req, res) {
  let twiml = new VoiceResponse();
  let dial = twiml.dial();
  let hostSid = req.query.hostSid;
  function gotoVoicemail() {
    if (req.body.DialCallStatus === "completed") {
      twiml.hangup();
    }
    else {
      twiml.redirect('/api/voicemail');
    }
  }
  
  // return the TwiML
  //   callback(null, twiml);
  client.calls(hostSid)
            .fetch()
            .then(function(call) { 
              if (call.status !== "in-progress") {
                gotoVoicemail();
                return;
              } 
              console.log(call.to);
  });


  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
};


module.exports.vmreceive = function (req, res) {
  let twiml = new VoiceResponse();
  let say = twiml.say("Please leave a message at the beep.  Press the star key when finished.");
  let record = twiml.record("", {
       maxLength:"20", 
       finishOnKey:"*",
       recordingStatusCallback: "/api/voicemail/saved"
    });
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  res.status(200).send(twiml.toString())
};

module.exports.vmsaved = function (req, res) {
  let twiml = new VoiceResponse();
  res.setHeader('Content-Type', 'application/xml')
  res.setHeader('Cache-Control', 'public, max-age=0')

  const requestBody = {
    personalizations: [{ to: [{ email: process.env.SENDGRID_RECEIVER }] }],
    from: { email: process.env.SENDGRID_SENDER },
    subject: `New voicemail message from: ${req.body.From}`,
    content: [
      {
        type: 'text/plain',
        value: `voicemail received: ${req.body.Recordingurl}`
      }
    ]
  };


  got.post('https://api.sendgrid.com/v3/mail/send', {
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
    .then(response => {
      let twiml = new Twilio.twiml.MessagingResponse();
      res.status(200).send(twiml.toString())
    })
    .catch(err => {
      callback(err);
    });
};

  

module.exports.track = function (req, res) {
  if (req.body.From === ('client: %s', req.user.configuration.twilio.clientName)) {
    // this is the client leg for outbound  we dont want this in our log
    res.setHeader('Content-Type', 'application/xml')
    res.status(200).end()
    return
  }

  /* we don't need this leg we are just interested in the
  connection time an status of the leg twilio --> client */
  if (req.body.To === req.user.configuration.phone.inbound.phoneNumber) {
    console.log('this is the pstn inbound leg phone we dont want this in our log')
    res.setHeader('Content-Type', 'application/xml')
    res.status(200).end()
    return

  }

  let call = {}

  call.sid = req.body.CallSid
  call.from = req.body.From
  call.to = req.body.To
  call.userId = req.user._id
  call.status = req.body.CallStatus

  if (req.body.To && req.body.To === (`client:${req.user.configuration.twilio.clientName}`)) {
    call.direction = 'inbound'
  } else {
    call.direction = 'outbound'
  }

  if (req.body.CallDuration) {
    call.duration = parseInt(req.body.CallDuration, 10)
  }

  Call.findOneAndUpdate({
    'sid': req.body.CallSid,
  },
    call, {
      new: true,
      upsert: true,
      runValidators: true,
    }).then(function (callStored) {
      console.log(`stored call event ${callStored.status}, id is ${callStored._id}`)

      res.setHeader('Content-Type', 'application/xml')
      res.status(200).end()
    }).catch(function (error) {
      console.log(error)
      res.setHeader('Content-Type', 'application/xml')
      res.status(500).end()
    })

}

module.exports.history = function (req, res) {
  let start = parseInt(req.query.start, 10) || 0

  let query = {
    start: start,
    limit: 10,
    refresh: false,
    more: false,
    timestamp: null,
  }

  return new Promise(function (resolve, reject) {

    if (req.query.timestamp) {
      console.log('timestamp set, check if there was any update since: %s', req.query.timestamp)

      Call.count({ 'userId': req.user._id, updatedAt: { '$gte': new Date(req.query.timestamp) } }).then(function (count) {
        /* the call history was updated in the meantime */
        if (count > 0) {
          query.limit = query.start + query.limit
          query.start = 0
          query.refresh = true
        }

        resolve()
      }).catch(function (error) {
        reject()
      })

    } else {
      resolve()
    }

  }).then(function (result) {

    return Call.find({ 'userId': req.user._id })
      .sort({ updatedAt: 'desc' })
      .skip(query.start)
      .limit((query.limit + 1))

  }).then(function (calls) {
    if (calls && calls.length === (query.limit + 1)) {
      calls.pop()
      query.more = true
    }

    query.timestamp = new Date()

    res.status(200).json({ query: query, calls: calls })

  }).catch(function (error) {
    console.log(error)
    res.status(500).end()
  })
}

module.exports.token = function (req, res) {
  const ClientCapability = twilio.jwt.ClientCapability

  const capability = new ClientCapability({
    accountSid: req.user.configuration.decrypted.accountSid,
    authToken: req.user.configuration.decrypted.authToken,
    ttl: 1200
  })

  if (req.user.configuration.phone.inbound.isActive === true) {
    capability.addScope(
      new ClientCapability.IncomingClientScope(req.user.configuration.twilio.clientName)
    )
  }

  if (req.user.configuration.phone.outbound.isActive === true) {
    capability.addScope(
      new ClientCapability.OutgoingClientScope({
        applicationSid: req.user.configuration.twilio.applicationSid,
        clientName: req.user.configuration.twilio.clientName
      })
    )
  }

  const token = { token: capability.toJwt() }

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=0')
  res.status(200).send(JSON.stringify(token, null, 3))
}
