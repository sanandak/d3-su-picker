/* d3-su-picker - pick arrivals in su dara

 * 1. start suServer.py - an obspy backend that reads the segy
 *    files and returns data as a json string
 * 2. a "controller" that connect to the server
 * 3. "directives" that plot the data
 */

var fs = require('fs');
var path = require('path');
var sprintf = require('sprintf-js').sprintf;
var cryp = require('crypto');
const cexec = require('child_process').execFile;

var app = angular.module('psqlApp', []);

/* mainctrl - angularjs controller that starts suserver
 * and provides data to the directives 
 */

app.controller('MainCtrl', ['$scope', function($scope) {

  self = this;
  self.filename = null;

  var pickedTraces;
  var wsURL = 'ws://localhost:9191/websocket';
  var ws;

  /* variables that appear on the front page or are provided to 
   * directives */
  self.wsIsOpen = false;
  self.nens = 0;
  self.ens0 = null;
  self.ensN = null;
  self.dt = null;
  self.currEns = null;
  self.currEnsNum = null;
  self.psd={freqs:[], psd:[]};

  self.fnyq=100;
  self.flo=null;
  self.fhi=null;
  self.startT=null;
  self.endT=null;

  /* start and periodically check for the server */
  
  function startws() {
    ws = new WebSocket(wsURL);
    ws.onopen = function() {
      self.wsIsOpen = true;
      console.log('ws opened');
      $scope.$apply();
    };
    ws.onerror = function() {
      console.log('ws err');
    }
  }
  function checkws() {
    //console.log('checking ws state');
    if(!ws || ws.readyState === WebSocket.CLOSED)
      startws();
  }
  setInterval(checkws, 5000);

  var hdrsByEnsemble;

  // when the user chooses "open" button, this function is called
  // it doesn't actually get the file - it calls the openfile
  // element
  self.open = function() {
    // this function will "click" the (invisible) openfile
    // button on the page, which will get the filename
    // that filename is sent to the server
    var chooser = document.getElementById('openfile');
    chooser.addEventListener('change', function() {
      var filepath = this.value;
      var flist = this.files;// from Files API

      // same file - ignore
      if (self.filename == filepath) {return;}
      
      self.filename = filepath;
      self.basename = path.basename(self.filename)

      // get hdrs only
      ws.send('{"cmd":"getSegyHdrs", "filename": "' + filepath + '"}');
      ws.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        var segyHdrs = JSON.parse(msg['segy'])
        //console.log(msg['cmd'], segyHdrs)

        // group into ensembles
        hdrsByEnsemble = d3.nest()
	  .key(function(d) {return d.ffid;})
	  .entries(segyHdrs.hdrs);
	// returns [{key:'0', values:[trc0, trc1, ...]}]

        self.nens = hdrsByEnsemble.length;
        self.ens0 = hdrsByEnsemble[0].key;
        self.ensN = hdrsByEnsemble[self.nens-1].key;
        self.dt = segyHdrs.dt;
        self.ns = segyHdrs.ns;
        self.startT = 0.;
        self.endT = (self.ns-1) * self.dt;
        self.fnyq = 1./(2*self.dt);
        self.currEns = null;

        console.log(self.nens, self.ens0, self.ensN, self.dt, self.currEns, self.fnyq);
        $scope.$apply();
      };
    })
    // presses the actual openfile (hidden) button
    chooser.click();
  }
  
  // when the user chooses "save", this function is called
   self.save = function() {
    //console.log('savemenu click');
    var chooser = document.getElementById('savefile');
    //console.log(chooser);
    chooser.addEventListener('change', function() {
      var filepath = this.value;
      console.log(filepath);
      console.log(pickedTraces);
      fs.writeFileSync(filepath,
                       JSON.stringify(
	                 {'sufile':self.filename,
                          'picktime':new Date(),
                          'picks': pickedTraces}));
      //      fs.writeFileSync(filepath, JSON.stringify(pickedTraces));
    })
    chooser.click();
   };

  // when the next and prev buttons are pressed...
  self.next = function() {
    //console.log("next ens")
    // first time...
    if(self.currEns === null) {self.currEns = 0;}
    else if(++self.currEns == self.nens) {self.currEns = 0;}
    
    var ens = hdrsByEnsemble[self.currEns].key;
    self.currEnsNum = ens;
    console.log('ens', self.currEns, ens);
    // see if the "filter" button is checked
    if(self.checkVal === true) {
      // if so, ask for filtered data
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "flo":"' + self.flo + '", "fhi":"' + self.fhi + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    } else {
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    }
    // get the PSD
    ws.send('{"cmd":"getPSD", "ensemble":"' + ens + '"}');
    ws.onmessage = function(evt) {
      var msg = JSON.parse(evt.data);
      console.log(msg['cmd'])
      // FIXME - this should be 'getEnsemble' not 'segy'
      if(msg['cmd'] == 'segy') {
        var segy = JSON.parse(msg['segy'])
        self.data=segy;
      } else if(msg['cmd'] == 'getPSD') {
        console.log('psd msg', msg);
        var psd = msg['psd'];
        var freqs = msg['freqs']
        self.psd = {'freqs': freqs, 'psd':psd};
        console.log(self.psd);
      }
      $scope.$apply();
    }
  };
  self.prev = function() {
    console.log("prev ens")
    if(self.currEns === null) {self.currEns = self.nens - 1;}
    else if(--self.currEns == -1) {self.currEns = self.nens-1;}
    var ens = hdrsByEnsemble[self.currEns].key;
    self.currEnsNum = ens;
    console.log('ens', ens);

    // FIXME - this is repeat of the "next" block
    if(self.checkVal === true) { 
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "flo":"' + self.flo + '", "fhi":"' + self.fhi + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    } else {
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    }
    ws.send('{"cmd":"getPSD", "ensemble":"' + ens + '"}');
    ws.onmessage = function(evt) {
      var msg = JSON.parse(evt.data);
      console.log(msg['cmd'])
      // FIXME - this should be 'getEnsemble' not 'segy'
      if(msg['cmd'] == 'segy') {
        var segy = JSON.parse(msg['segy'])
        self.data=segy;
      } else if(msg['cmd'] == 'getPSD') {
        console.log('psd msg', msg);
        var psd = msg['psd'];
        var freqs = msg['freqs']
        self.psd = {'freqs': freqs, 'psd':psd};
        console.log(self.psd);
      }
      $scope.$apply();
    };
  }

  // handle the filter value changes...
  self.checkVal = false;
  self.fcheck = function() {
    console.log("check:", self.checkVal);
    console.log("f", self.flo, self.fhi);

    var ens = hdrsByEnsemble[self.currEns].key;
    console.log('ens', self.currEns, ens);
    if(self.checkVal) {
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "flo":"' + self.flo + '", "fhi":"' + self.fhi + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    } else {
      ws.send('{"cmd":"getEnsemble", "ensemble":"' + ens + '", "t1":"' + self.startT + '", "t2":"' + self.endT + '"}');
    };
    ws.onmessage = function(evt) {
      var msg = JSON.parse(evt.data);
      console.log(msg['cmd'])
      // FIXME - this should be 'getEnsemble' not 'segy'
      if(msg['cmd'] == 'segy') {
        var segy = JSON.parse(msg['segy'])
        self.data=segy;
	//console.log(msg['cmd'], segy)
	self.data=segy;
	$scope.$apply();
      }
    }
  };
    
  // when the directive updates picks, this function is called
  // to update the local variable pickedTraces...
  self.setpicks = function(picks) {
    pickedTraces = picks;
  }
}]);

