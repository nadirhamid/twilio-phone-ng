function PhoneController($scope, $rootScope, $http, $window, $timeout, tokenService) {
  $scope.user = $window.user;
  $scope.debug = '...';
  $scope.isOffline = false;
  $scope.tabIndex = 0;
  $scope.states = { token: null, interface: 'unknown' }
  $scope.settings = {
    volume: {
      min: 0,
      max: 100
    }
  };

  $scope.isInvalidBrowser = false;
  $scope.invalidBrowserMessage = '';
  $scope.volume = 100;

  $scope.onOnline = function (event) {
    console.log('browser send online event: ' + event.type);
    
    /* wait a few seconds and check if the token became invalid */
    $timeout(function () {
      $scope.isOffline = false;

      if($scope.states.token !== 'fetched') {
        $scope.setup()
      }
    }, 8000);

    $scope.$apply();
  };

  $scope.onOffline = function (event) {
    console.log('browser send online event: ' + event.type);
    $scope.isOffline = true;
    $scope.$apply();
  };

  $scope.openSetup = function () {
    $window.location.href = '/setup';
  };

  $scope.setup = function () {

    tokenService.fetch().then((token) => {
      $scope.states.token = 'fetched'
      $scope.$apply();

      console.log('fetch of token successfull ')
      $scope.setupDevice(token)
    }).catch((error) => {
      $scope.states.token = 'error'
      $rootScope.state = 'error';
      $scope.$apply();
    })

};

$scope.setupDevice = function (token) {

  try {
    Twilio.Device.setup(token, { debug: true, dscp: true });
  } catch (e) {
    $scope.invalidBrowserMessage = e.message;
    $scope.isInvalidBrowser = true;
    $rootScope.state = 'error';
  }

}

$scope.register = function () {

  Twilio.Device.incoming(function (connection) {
    $rootScope.$broadcast('incoming', {
      connection: connection,
    });
  });

  Twilio.Device.cancel(function (connection) {
    $rootScope.$broadcast('cancel', {
      connection: connection,
    });
  });

  Twilio.Device.disconnect(function (connection) {
    $rootScope.$broadcast('disconnect', {
      connection: connection,
    });
  });

  Twilio.Device.offline(function () {
    if ($rootScope.state !== 'busy' && $rootScope.state !== 'incoming') {
      $rootScope.state = 'offline';
    }
    $scope.$apply();
  });

  Twilio.Device.error(function (error) {
  
    if (error.code === 31205) {
      $scope.states.token = 'expired'

      if(!$scope.isOffline) {
        $scope.setup()
      }

    } else {
      $timeout(function () {
        console.log('client error: %j', error);
        $rootScope.state = 'error';
      });
    }

  });

  Twilio.Device.ready(function () {
    $scope.debug = 'phone is ready';
    if ($rootScope.state !== 'busy' && $rootScope.state !== 'incoming') {
      $rootScope.state = 'idle';
    }
    $scope.$apply();
  });

};

$scope.$on('call', function (event, parameters) {
  var connection = Twilio.Device.connect({
    PhoneNumber: parameters.phoneNumber,
  });

  $rootScope.$broadcast('outgoing', {
    connection: connection,
    phoneNumber: parameters.phoneNumber,
  });

});

$scope.initHistory = function () {
  $rootScope.$broadcast('call-history', null);
};

$scope.init = function () {
  window.addEventListener('online', $scope.onOnline);
  window.addEventListener('offline', $scope.onOffline);

  let inbound = $scope.user.configuration.phone.inbound.isActive;
  let outbound = $scope.user.configuration.phone.outbound.isActive;

  if (inbound === false && outbound === false) {
    $rootScope.state = 'setup-required';
  } else {
    $scope.register();
    $scope.setup();
  }
};

$scope.$on('select-keypad', function (event, parameters) {
  $scope.tabIndex = 0;
});

$scope.updateVolume(volume) {
  var connection = Twilio.Device.activeConnection();
  var stream = connection.getRemoteStream();
  var ctx = new AudioContext();
  var source = ctx.createMediaStreamSource(stream);
  var dest = ctx.createMediaStreamDestination();
  var gainNode = ctx.createGain();
  source.connect(gainNode);
  gainNode.connect(dest);
  gainNode.gain.value = volume;
  // Example: play the audio
  // Or if you use WebRTC, use peerConnection.addStream(dest.stream);
  new Audio(URL.createObjectURL(dest.stream)).play();

  // Store the source and destination in a global variable
  // to avoid losing the audio to garbage collection.
  window.leakMyAudioNodes = [source, dest]; 


}
$scope.addThirdMember() {
  var number = window.prompt("please enter third number. ex: +15874874526");
  if (!number) {
    window.alert("no number entered");
    return;
  }
  $http.post("/api/conference", {
    "number": number
  }).then(function() {
    window.alert("added third member..");
  });
  
}

angular
  .module('phoneApplication')
  .controller('PhoneController', PhoneController);
