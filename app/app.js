var fs = require('fs');
//var gui = require('nw.gui')
global.window = window;
global.gui = require('nw.gui');

var menu = require('./app/menu.js');
menu.initMenu();

console.log('after initmenu');

var sprintf = require('sprintf-js').sprintf;
var cryp = require('crypto');
const cexec = require('child_process').execFile;
var readSU = require('segy-js').readSU;
var fileio = require('./app/fileio.js')

var app = angular.module('psqlApp', []);

app.factory('ReadData', [function() {
  var filename = null;
  return {
    set: function(d) {
      filename = d;
    },
    get: function() {
      return filename;
    },
  };
}]);


app.controller('MainCtrl', ['$scope', 'ReadData', function($scope, ReadData) {

  self = this;
  self.filename = null;
  self.msg = 'PSQL';

  var win = global.gui.Window.get();

  // initMenu added 'File', and 'File->Open and Save'
  // search for them here.
  var filemenu = win.menu.items
      .find(function(d) {
	return d.label == 'File';
      }) //, 'File');
  var openmenu = filemenu.submenu.items
      .find(function(d) {
	return d.label == 'Open';
      }) //, 'Open');
  var savemenu = filemenu.submenu.items
      .find(function(d) {
	return d.label == 'Save';
      }) //, 'Save');
  //  console.log(filemenu, openmenu, savemenu)
  var alldata;
  var pickedTraces;
  var wsURL = 'ws://localhost:9191/websocket';
  var ws;

  var server = cexec('./suServer.py')
  
  server.stdout.on('data', (data) => {
    console.log('suserv stdout', data);
  })
  server.stderr.on('data', (data) => {
    console.log('suserv stderr', data);
  })

  process.on('SIGTERM', function() {
    server.kill('SIGTERM');
  })
  process.on('SIGINT', function() {
    server.kill('SIGTERM');
  })

  self.wsIsOpen = false;
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
//    ws.onclose = function() {
//      console.log('ws closed');
      // try again?
//      checkws();
//    }
  }
  function checkws() {
    //console.log('checking ws state');
    if(!ws || ws.readyState === WebSocket.CLOSED)
      startws();
  }
  setInterval(checkws, 5000);


  // when the user chooses "open", this function is called
  openmenu.on('click', function() {
    // this function will "click" the (invisible) openfile
    // button on the page, which will read the data
    var chooser = document.getElementById('openfile');
    //console.log(chooser);

    chooser.addEventListener('change', function() {
      var filepath = this.value;
      var flist = this.files;// from Files API
      self.filename = filepath;
      console.log(this, this.files, filepath);

      ws.send('{"cmd":"getSegy", "filename": "' + filepath + '"}');
      ws.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        var segy = JSON.parse(msg['segy'])
        console.log(msg['cmd'])
        self.data=segy;
        $scope.$apply();
      };

      /*
      var reader = new FileReader();
      reader.onerror = function(event) {
        console.log('error reading', event.target.error);
      }
      reader.onloadend = function(event) {
        var contents = event.target.result;
        console.log('file read', contents.byteLength);
        //self.progressVal = 81000;
      };
      reader.onprogress = function(event) {
        //console.log('progress', event.total, event.loaded);
        self.progressMax = event.total;
        self.progressVal = event.loaded;
        $scope.$apply();
      };

      reader.readAsArrayBuffer(flist[0]);
      */

      /*
      alldata = readSU(filepath);
      console.log(alldata);
      self.data = alldata;
      $scope.$apply();
      */
    })
    chooser.click();
  });
  
  // when the user chooses "save", this function is called
  savemenu.on('click', function() {
    console.log('savemenu click');
    var chooser = document.getElementById('savefile');
    console.log(chooser);
    chooser.addEventListener('change', function() {
      var filepath = this.value;
      console.log(filepath);
      fs.writeFileSync(filepath, JSON.stringify(pickedTraces));
    })
    chooser.click();
  });
  
  // when the directive updates picks, this function is called
  // to update the local variable pickedTraces...
  self.setpicks = function(picks) {
    pickedTraces = picks;
  }

  
  
}]);

/*
 * d3-ricker will generate 2 windows: the main and zoom windows
 * and allow picking
 */
app.directive('d3Ricker', ['ReadData', function(ReadData) {
  function link(scope, element, attr) {
//    console.log('dir', ReadData.get());
//    ReadData.set('hi directive');
//    console.log('dir', ReadData.get());

    var el = element[0];
    
    var width = 900,
	height = 600;
    
    var data;
    var dt,traces, currEns, ensIdx, pickedTraces;
    var firstTrc, lastTrc, ntrcs, npts, traceLen, cursT, cursTrc;
    var tracesByEnsemble;

    /* init - label traces with unique id and sort */
    var init = function () {
      // label traces with unique id
      //console.log(data.traces)
      data.traces.forEach(function(d) {
        d.id = cryp.randomBytes(5).toString('hex');
      });
      //console.log(traces[0], traces[1])

      // group into ensembles
      tracesByEnsemble = d3.nest()
	.key(function(d) {
          return d.ffid;
	})
	.entries(data.traces);
      // returns [{key:'0', values:[trc0, trc1, ...]}]
      
      traces = tracesByEnsemble[0].values;
      currEns = tracesByEnsemble[0].key;
      ensIdx = 0;
      dt = data.dt;
      pickedTraces = [];

    // add a "trace number within ensemble" header word
      for(var i=0; i<tracesByEnsemble.length; i++) {
        tracesByEnsemble[i].values.forEach(function(d,i) {
          d.tracens = i;
        });
      }
      //console.log('ens', tracesByEnsemble, currEns);

      firstTrc = 0;
      lastTrc = traces.length - 1;
      ntrcs = traces.length;
      npts = traces[0].samps.length;
      traceLen = (npts - 1) * dt;

      cursT = Math.floor(npts/2) * dt;
      cursTrc = Math.floor((lastTrc - firstTrc) / 2);
    }

    data = scope.data;
    //console.log(data.traces);
    init();

//    scope.$watch('data', function(newval, oldval, scope) {
//      console.log('data changed', newval, oldval);
//      data = scope.data;
//      init();
//    }, true);

    //console.log('ffid = ', ffids, ffididx);
    //console.log('traces = ', traces, 'dt = ', dt, 'ntrcs =', ntrcs, 'npts =', npts);
    console.log('dt = ', dt, 'ntrcs =', ntrcs, 'npts =', npts);

    /*  form of the data:
        self.data = {dt: dt,
        traces: [
        {ffid: 0, offset: x, samps:[{t:..,v:..},{t:..,v:..},..]}
        {ffid: 0, offset: y, samps:[{t:..,v:..},{t:..,v:..},..]}
        {ffid: 0, offset: z, samps:[{t:..,v:..},{t:..,v:..},..]}
        ...
        ]};

    */

    console.log('width,height', width, height);
    var margins = {
      left: 50,
      right: 30,
      top: 30,
      bottom: 30
    },
	w = 300 - margins.left - margins.right,
	h = 600 - margins.top - margins.bottom;

    var margins2 = {
      left: 50,
      right: 30,
      top: 30,
      bottom: 30
    },
	w2 = 500 - margins2.left - margins2.right,
	h2 = 600 - margins2.top - margins2.bottom;

    //    var svg = svgOuter.append('svg')
    var svg = d3.select(element[0])
	.append('svg')
	.attr('width', w + margins.left + margins.right)
	.attr('height', h + margins.top + margins.bottom)
	.append('g')
	.attr('transform', 'translate(' + margins.left + ',' + margins.top + ')');

    //svg.append('g').attr('class', 'data');
    svg.append('g').attr('class', 'x-axis axis');
    svg.append('g').attr('class', 'y-axis axis');

    var tScale = d3.scaleLinear()
	.domain([0, (npts - 1) * dt])
	.range([0, h]);
    var tAxis = d3.axisLeft(tScale);

    var vScale = d3.scaleLinear()
	.domain([-1, 1])
	.rangeRound([0, w]);
    var vAxis = d3.axisTop(vScale);

    var oScale = d3.scaleLinear()
        .domain([0,2450])
        .range([0,w])
    
    var oAxis = d3.axisTop(oScale);

    svg.select('.x-axis')
      .call(oAxis
            .ticks(5))
    //      .call(vAxis)
    svg.select('.y-axis')
      .call(tAxis)

    // svg.append('linearGradient')
    //     .attr('id', 'line-gradient')
    //     .attr('gradientUnits', 'userSpaceOnUse')
    //     .attr('x1', 0).attr('y1', yScale(-1))
    //     .attr('x2', 0).attr('y2', yScale(1))
    //     .selectAll('stop')
    //     .data([
    //  {'offset':'0%', color:'blue'},
    //  {'offset':'100%', color:'red'}
    //     ])
    //     .enter()
    //     .append('stop')
    //     .attr('offset', function(d) {return d.offset;})
    //     .attr('stop-color', function(d) {return d.color;})

    var line = d3.line()
	.x(function(d) {
          return vScale(d.v);
	})
	.y(function(d) {
          return tScale(d.t);
	});
    var area = d3.area()
	.y(function(d) {
          return tScale(d.t);
	})
	.x0(vScale(0))
	.x1(function(d) {
          return vScale(d.v);
	});

    var xofs;
    var lineg = svg.append('g')
	.attr('class', 'lineg');
    lineg
      .selectAll('.line')
      .data(traces, function(d) {
        return d.id;
      })
      .enter()
      .append('path')
      .attr('class', 'line')
      .attr('d', function(d) {
        return line(d.samps);
      })
      .attr('transform', function(d, i) {
        xofs = (w / ntrcs * i);
        return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
      });

    svg.append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('y1', 0).attr('x1', vScale(-1))
      .attr('y2', 0).attr('x2', vScale(1))
      .selectAll('stop')
      .data([{ 'offset': '0%', color: 'red'},
	     { 'offset': '25%', color: 'red'},
	     { 'offset': '50%', color: 'white'},
	     { 'offset': '50%', color: 'white'},
	     { 'offset': '75%', color: 'blue'},
	     { 'offset': '100%', color: 'blue'}
	    ])
      .enter()
      .append('stop')
      .attr('offset', function(d) {return d.offset;})
      .attr('stop-color', function(d) {return d.color;})

    svg.append('linearGradient')
      .attr('id', 'focus-area-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('y1', 0).attr('x1', vScale(-1))
      .attr('y2', 0).attr('x2', vScale(1))
      .selectAll('stop')
      .data([{'offset': '0%',color: 'red'},
	     {'offset': '50%',color: 'white'},
	     {'offset': '100%',color: 'blue'}])
      .enter()
      .append('stop')
      .attr('offset', function(d) {return d.offset;})
      .attr('stop-color', function(d) {return d.color;})

    var areag = svg.append('g')
	.attr('class', 'areag');
    areag
      .selectAll('.fills')
      .data(traces, function(d, i) { return d.id;})
      .enter()
      .append('path')
      .attr('class', 'fills')
      .attr('fill', 'url(#area-gradient)')
      .attr('d', function(d) {
        return area(d.samps);
      })
      .attr('transform', function(d, i) {
        xofs = (w / ntrcs * i);
        return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
      })

    /* Focus
     * plot the zoomed in data
     */

    var vScale2 = d3.scaleLinear().range([0, w2]);
    var tScale2 = d3.scaleLinear().range([0, h2]);

    tScale2.domain([0, (npts - 1) * dt]);
    vScale2.domain([-1, 1]);

    var vAxis2 = d3.axisTop(vScale2);
    var tAxis2 = d3.axisLeft(tScale2);

    //    var focus = svgOuter.append('svg')
    var focus = d3.select(element[0])
	.append('svg')
	.attr('width', w2 + margins2.left + margins2.right)
	.attr('height', h2 + margins2.top + margins2.bottom)
	.append('g')
	.attr('transform', 'translate(' + margins2.left + ',' + margins2.top + ')');
    //    var focus = svgOuter.append('g')
    //        .attr('class', 'focus')
    //        .attr('transform', 'translate(' + margins2.left + ',' + margins2.top + ')');

    var focusLine = d3.line()
    //        .curve(d3.curveMonotoneY)
	.x(function(d, i) { return vScale2(d.v);})
	.y(function(d, i) { return tScale2(d.t);})

    var focusArea = d3.area()
	.y(function(d, i) {return tScale2(d.t);})
	.x0(vScale2(0))
    //        .curve(d3.curveMonotoneY)
	.x1(function(d, i) {return vScale2(d.v);});

    /* add zoom box */

    /*
      var zoom = d3.zoom()
      .scaleExtent([1, Infinity])
      .translateExtent([[0, 0], [w2, h2]])
      .extent([[0, 0], [w2, h2]])
      //      .on('zoom', zoomed);

      svg.append('rect')
      .attr('class', 'zoom')
      .attr('width', w)
      .attr('height', h)
      .attr('transform', 'translate(' + margins.left + ',' + margins.top + ')')
      .call(zoom)
    */

    /* draw focus traces */
    var bisectT = d3.bisector(function(d) {
      return d.t;
    }).left;
    focus.append('defs').append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', w2)
      .attr('height', h2);

    var clipping = focus.append("g")
        .attr("clip-path", "url(#clip)");

    console.log(vScale2.domain(), vScale2.range());
    var firstTrc = 0,
	lastTrc = traces.length - 1;
    var ntrcsFoc = lastTrc - firstTrc + 1;
    var xofsFoc;

    var fareag = clipping.append('g')
	.attr('class', 'fareag')
    fareag
      .selectAll('.ffills')
      .data(traces, function(d, i) {
        return d.id;
      })
      .enter()
      .append('path')
      .attr('class', 'ffills')
    //        .attr('fill', 'url(#focus-area-gradient)')
      .attr('fill-opacity', function(d,i) {return ((i==cursTrc) ? 1 : .3);})
      .attr('d', function(d, i) {
        return focusArea(d.samps);
      })
      .attr('transform', function(d, i) {
        xofsFoc = (w2 / ntrcsFoc * i);
        return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
      })

    var flineg = clipping.append('g')
	.attr('class', 'flineg')
    flineg
      .selectAll('.fline')
      .data(traces, function(d, i) {
        return d.id;
      })
      .enter()
      .append('path')
      .attr('class', 'fline')
      .attr('d', function(d) {
        return focusLine(d.samps);
      })
      .attr('transform', function(d, i) {
        xofsFoc = (w2 / ntrcsFoc * i);
        return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
      })

    focus.append('g')
      .attr('class', 'axis x-axis')
      .call(vAxis2)
    focus.append('g')
      .attr('class', 'axis y-axis')
      .call(tAxis2)

    /*
      var tt = d3.select(element[0])
      .append('svg')
      .attr('width', w2 + margins2.left + margins2.right)
      .attr('height', h2 + margins2.top + margins2.bottom)
      .append('g')
      .attr('transform', 'translate(' + margins2.left + ',' + margins2.top + ')');
      var xScale3 = d3.scaleLinear().range([0, w2]);
      var yScale3 = d3.scaleLinear().range([h2, 0]);
      xScale3.domain([0, (npts - 1) * dt]);
      yScale3.domain([ntrcs, 0]);
      var xAxis3 = d3.axisBottom(xScale3);
      var yAxis3 = d3.axisLeft(yScale3);
      tt.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', 'translate(0,' + h2 + ')')
      .call(xAxis3)
      tt.append('g')
      .attr('class', 'axis y-axis')
      .call(yAxis3);

      var ttpts = tt.append('g')
      .attr('class', 'ttpts');
    */
    var updateFocusLines = function() {
      ntrcsFoc = lastTrc - firstTrc + 1;
      console.log('update lines', lastTrc, firstTrc, ntrcsFoc);
      var l = d3.selectAll('.flineg')
          .selectAll('.fline')
          .data(traces.slice(firstTrc, lastTrc + 1), function(d) {
            return d.id;
          })
      // draw the current set of lines
      // update existing
      //      console.log(l);
      l
        .transition()
        .attr('transform', function(d, i) {
          xofsFoc = (w2 / ntrcsFoc * i);
          //          console.log('update line',i, xofsFoc);
          return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
        })
      // remove any old ones
      l.exit().remove();

      // and add new ones...
      l.enter()
        .append('path')
        .attr('class', 'fline')
        .attr('d', function(d) {
          return focusLine(d.samps);
        })
        .attr('transform', function(d, i) {
          xofsFoc = (w2 / ntrcsFoc * i);
          return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
        })
    };

    var updateFocusAreas = function() {
      ntrcsFoc = lastTrc - firstTrc + 1;
      var l = d3.selectAll('.fareag')
          .selectAll('.ffills')
          .data(traces.slice(firstTrc, lastTrc + 1), function(d) {
            return d.id;
          })
      l
        .attr('fill-opacity', function(d,i) {
          console.log('fill', i, cursTrc-firstTrc);
          return ((i===(cursTrc-firstTrc)) ? 1 : .3);
        })
        .attr('transform', function(d, i) {
          xofsFoc = (w2 / ntrcsFoc * i);
          //        console.log('update area',i, xofsFoc);
          return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
        })
      l.enter()
        .append('path')
        .attr('class', 'ffills')
        .attr('d', function(d) {
          return focusArea(d.samps);
        })
        .attr('fill-opacity', function(d,i) {return ((i==(cursTrc-firstTrc)) ? 1 : .3);})

        .attr('transform', function(d, i) {
          xofsFoc = (w2 / ntrcsFoc * i);
          //          console.log('enter area',i, xofsFoc);
          return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
        })
      l.exit().remove();
    };

    var updateCursor = function() {
      // redraw the cursor
      ntrcsFoc = lastTrc - firstTrc + 1;
      xofsFoc = (w2 / ntrcsFoc * (cursTrc - firstTrc));
      sampNo = bisectT(traces[cursTrc].samps, cursT);
      console.log('updateCursor', xofsFoc, sampNo);
      cursor.select('#cursor')
        .attr('cy', tScale2(traces[cursTrc].samps[sampNo].t))
        .attr('cx', vScale2(traces[cursTrc].samps[sampNo].v) / ntrcsFoc)
        .attr('transform', 'translate(' + xofsFoc + ',0)')

      
      cursorText = sprintf('ensemble %s trace: %d time: %.3f value: %+.3f', currEns, cursTrc, cursT, traces[cursTrc].samps[sampNo].v);
      focus.select('#ctext')
        .text(cursorText)

    };

    var updatePicks = function() {
      // and the picks
      var r = vScale2.range();
      ntrcsFoc = lastTrc - firstTrc + 1;
      var trchtFoc = Math.abs(r[0] - r[1]) / ntrcsFoc;
      var p = pickg.selectAll('.picks')
          .data(traces
                .filter(function(d){return typeof d.pickT !== 'undefined';}),
                function(d) {return d.id;});

      console.log('update picks', p);
      p
        .transition()
        .duration(1000)
        .attr('y', function(d) {
          return tScale2(d.pickT);
        })
        .attr('x', function(d) {
          return vScale2(0) / ntrcsFoc - trchtFoc / 2;
        })
        .attr('width', trchtFoc)
        .attr('transform', function(d) {
          //                var trc = d.trace;
          //                var tim = d.pick.x;
          xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
          return 'translate(' + xofsFoc + ',0)';
        });

      p
        .enter()
        .append('rect')
        .attr('class', 'picks')
        .attr('y', function(d) {
          return tScale2(d.pickT);
        })
        .attr('x', function(d) {
          return vScale2(0) / ntrcsFoc - trchtFoc / 2;
        })
        .attr('width', trchtFoc)
        .attr('height', 2)
        .attr('transform', function(d) {
          //                var trc = d.trace;
          //                var tim = d.pick.x;
          xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
          return 'translate(' + xofsFoc + ',0)';
        });

      p
        .exit()
        .remove();

    }

    /* draw the circle cursor */

    var sampNo = bisectT(traces[cursTrc].samps, cursT);
    xofsFoc = w2 / ntrcsFoc * (cursTrc - firstTrc);
    var cursor = focus.append('g')
	.style('display', null);
    cursor.append('circle')
      .attr('id', 'cursor')
      .attr('class', 'cursor')
      .attr('r', 6)
      .attr('cy', tScale2(traces[cursTrc].samps[sampNo].t))
      .attr('cx', vScale2(traces[cursTrc].samps[sampNo].v) / ntrcsFoc)
      .attr('transform', 'translate(' + xofsFoc + ',0)')

    var cursorText = sprintf('ensemble %s trace: %d time: %.3f', currEns, cursTrc, cursT);
    var cText = focus.append('g')
	.append('text')
	.attr('id', 'ctext')
	.attr('class', 'ctext')
	.attr('transform', 'translate(' + w2 / 2 + ',' + (h2 + margins2.top) + ')')
	.text(cursorText)

    /* define the pick line vars (needed by brush?) */
    var picks = [];
    var pickg = focus.append('g');

    /* handle the brush */
    var brush = d3.brushY()
	.extent([
          [0, 0],
          [w, h]
	])
	.on('brush end', brushed);

    svg.append('g')
      .attr('class', 'brush')
      .call(brush)
      .call(brush.move, tScale.range())

    console.log('brush', d3.brushSelection(svg.select('.brush').node()));

    // reduce the opacity from default 0.4
    svg.select('.brush .selection')
      .attr('fill-opacity', 0.2)
    // make the handles visible
    svg.select('.brush .handle--n')
      .attr('fill', 'red')
      .attr('fill-opacity', 0.3)
    svg.select('.brush .handle--s')
      .attr('fill', 'red')
      .attr('fill-opacity', 0.3)

    // function called when the brush is dragged
    function brushed() {
      var s = d3.event.selection || tScale.range();
      tScale2.domain(s.map(tScale.invert, tScale));
      focus.select('.y-axis')
        .call(tAxis2)

      //            console.log(xScale2.domain(), xScale2.range());
      // redraw the lines in the focus area
      focus.selectAll('.fline')
        .attr('d', function(d) {
          return focusLine(d.samps);
        });
      focus.selectAll('.ffills')
        .attr('d', function(d) {
          return focusArea(d.samps);
        })

      // put the cursor in the middle of the brushed window?
      var d = tScale2.domain();
      cursT = (d[1] - d[0])/2 + d[0];
      console.log(d,cursT);
      updateCursor();
      
    };

    /* function called to save data to disk */
    var savedata = function() {
      var fName = 'test.dat';
      var dirPath = '/Users/sak/Desktop/Picks';
      var fileName = dirPath + '/' + fName;
      try {
        fs.statSync(dirPath);
      } catch (e) {
        fs.mkdirSync(dirPath);
      }

      fs.writeFileSync(fileName, JSON.stringify(picks, null, 2));
    };

    /* handle key interactions */

    d3.select('body')
      .on('keydown', function(d) {
        // scale traces up and down
        if (d3.event.key === 'y' || d3.event.key === 'Y') {
          var vdom = vScale2.domain();
          console.log(d3.event, vdom);
          var scl = d3.event.shiftKey ? .5 : 2;
          vdom = vdom.map(function(d) {
            return d * scl;
          })
          vScale2.domain(vdom);
          focus.select('.x-axis')
            .call(vAxis2)
          focus.selectAll('.fline')
            .attr('d', function(d) {
              return focusLine(d.samps);
            })
          focus.selectAll('.ffills')
            .attr('d', function(d) {
              return focusArea(d.samps);
            })
        }


        switch (d3.event.key) {
          // display next/prev ens
        case 'N':
          console.log('N', tracesByEnsemble)
          ensIdx = Math.min(tracesByEnsemble.length-1, ++ensIdx);
          currEns = tracesByEnsemble[ensIdx].key;
          traces = tracesByEnsemble[ensIdx].values;
          ntrcs = traces.length;
          console.log(traces, ntrcs, ensIdx);

          var l = lineg.selectAll('.lines')
              .data(traces, function(d) {return d.id;});
          l.exit().remove();
          l.enter()
            .append('path')
            .attr('class', 'lines')
            .attr('d', function(d) {
              return line(d.samps);
            })
            .attr('transform', function(d, i) {
              xofs = (w / ntrcs * i);
              return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
            });

          l = areag.selectAll('.fills')
            .data(traces, function(d) {return d.id;})
          l.exit().remove();
          l.enter()
            .append('path')
            .attr('class', 'fills')
            .attr('fill', 'url(#area-gradient)')
            .attr('d', function(d) {
              return area(d.samps);
            })
            .attr('transform', function(d, i) {
              xofs = (w / ntrcs * i);
              return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
            });

          updateFocusLines();
          updateFocusAreas();
	  updateCursor();
          updatePicks();
          break;
          
        case 'P':
          console.log('P')
          ensIdx = Math.max(0, --ensIdx);
          traces = tracesByEnsemble[ensIdx].values;
          ntrcs = traces.length;
          console.log(traces, ntrcs, ensIdx);

          l = lineg.selectAll('.lines')
            .data(traces, function(d) {return d.id;});
          l.exit().remove();
          l.enter()
            .append('path')
            .attr('class', 'lines')
            .attr('d', function(d) {
              return line(d.samps);
            })
            .attr('transform', function(d, i) {
              xofs = (w / ntrcs * i);
              return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
            });

          l = areag.selectAll('.fills')
            .data(traces, function(d) {return d.id;})
          l.exit().remove();
          l.enter()
            .append('path')
            .attr('class', 'fills')
            .attr('fill', 'url(#area-gradient)')
            .attr('d', function(d) {
              return area(d.samps);
            })
            .attr('transform', function(d, i) {
              xofs = (w / ntrcs * i);
              return 'translate(' + xofs + ',0) scale(' + 1 / ntrcs + ',1)';
            });

          updateFocusLines();
          updateFocusAreas();
	  updateCursor();
	  updatePicks();
          break;

          // move cursor left/right
        case 'j':
        case 'k':
        case 'J':
        case 'K':
          var td = tScale2.domain();
          var tdlen = td[1] - td[0];
          var incr = d3.event.shiftKey ? 10 : 1;
          incr *= (d3.event.code === 'KeyK') ? -1 : 1;
          cursT = cursT + incr * dt;
          cursT = Math.floor(cursT/dt) * dt; // make cursT a multiple of dt always
          
          console.log('td0',cursT, td, tdlen);
          if (cursT <= td[0] || cursT >= td[1]) {
            if (cursT <= td[0]) {
              td[0] -= tdlen/4;
              if(td[0] < 0) td[0] = 0;
              td[1] = td[0] + tdlen;
            } else {
              td[1] += tdlen/4;
              if(td[1] > (npts-1)*dt) td[1] = (npts-1) * dt;
              td[0] = td[1] - tdlen;
            }
            
            
            console.log('td1',td);
            
            tScale2.domain(td);
            focus.select('.y-axis')
              .transition()
              .duration(1000)
              .ease(d3.easeQuad)
              .call(tAxis2)
            focus.selectAll('.fline')
              .transition()
              .duration(1000)
              .ease(d3.easeQuad)
              .attr('d', function(d) {
                return focusLine(d.samps);
              })
            focus.selectAll('.ffills')
              .transition()
              .duration(1000)
              .ease(d3.easeQuad)
              .attr('d', function(d) {
                return focusArea(d.samps);
              })

            updatePicks();
          }
          updateCursor();

          break;

          // move cursor to prev/next trace
        case 'h':
        case 'l':
        case 'H':
        case 'L':
	  //            console.log('hl key', d3.event.code, d3.event.shiftKey, cursTrc, firstTrc, lastTrc);
          var trcincr = d3.event.shiftKey ? 10 : 1;
          trcincr *= d3.event.code === 'KeyL' ? 1 : -1;
          cursTrc = Math.min(cursTrc + trcincr, lastTrc);
          cursTrc = Math.max(cursTrc, firstTrc);

          var i = bisectT(traces[cursTrc].samps, cursT);
          xofsFoc = (w2 / ntrcsFoc * (cursTrc - firstTrc));
          console.log('jk key', d3.event.code, d3.event.shiftKey, cursTrc, firstTrc, lastTrc, i, xofsFoc);

          updateCursor();

          // dim other traces
          fareag.selectAll('.ffills')
            .attr('fill-opacity', function(d,i) {
	      //                console.log('hl', i, cursTrc, firstTrc);
              return ((i===cursTrc-firstTrc) ? 1 : 0.3);
            })
          break;

          // remove the current pick
        case 'd':
          delete traces[cursTrc].pickT;
          delete traces[cursTrc].pickSamp;
          // search for this trc in the pickedtraces
          var idx = pickedTraces.map(function(d) {return d.id;})
              .indexOf(traces[cursTrc].id);
          if(idx >= 0)
            pickedTraces.splice(idx,1); // remove it

          // console.log(idx, pickedTraces);
          updatePicks();

          // tell the controller about the changes.
          scope.setpicks({picks: pickedTraces});
          break;
          
          // pick the current value
        case 'p':
          var r = vScale2.range();
          var trchtFoc = (r[1] - r[0]) / ntrcsFoc;

          traces[cursTrc].pickT = cursT;
          traces[cursTrc].pickSamp = i;

          // am I re-picking?  Search for cursTrc id in pickedTraces
          var idx = pickedTraces.map(function(d) {return d.id;})
              .indexOf(traces[cursTrc].id);
          if (idx >= 0) { // found it...
            pickedTraces[idx] = traces[cursTrc];
          } else { // new pick
            pickedTraces.push(traces[cursTrc]);
          }
          // tell the controller about it...
          scope.setpicks({picks: pickedTraces});
          console.log('pick', firstTrc, traces[cursTrc]);

          // update the pick line (if this is a re-pick)
          pickg
            .selectAll('.picks')
            .transition()
            .attr('y', function(d) {
              return tScale2(d.pickT) - 1;
            })

          // or draw a new one.
          pickg
            .selectAll('.picks')
            .data(traces
                  .filter(function(d){
                    return typeof d.pickT !== 'undefined';}),
                  function(d) {return d.id;})
            .enter()
            .append('rect')
            .attr('class', 'picks')
            .attr('y', function(d) {return tScale2(d.pickT);})
            .attr('x', function(d) {return vScale2(0)/ntrcsFoc - trchtFoc/2;})
            .attr('width', trchtFoc)
            .attr('height', 2)
            .attr('transform', function(d) {
              xofsFoc = (w2 / ntrcsFoc * (d.tracens-firstTrc));
              //console.log('pick enter',d, xofsFoc);
              return 'translate(' + xofsFoc + ',0)';
            })
            .attr('stroke', 'none')
            .attr('fill-opacity', 0.5)
            .attr('fill', 'black');
          /*
            ttpts
            .selectAll('.ttpts')
            .data(picks)
            .enter()
            .append('circle')
            .attr('cx', function(d) {
            return xScale3(d.pick.t);
            })
            .attr('cy', function(d) {
            return yScale3(d.trace);
            })
            .attr('r', 5)
            .attr('class', 'ttpts')
            .attr('stroke', 'blue')
            .attr('fill', 'blue')
            ttpts
            .selectAll('.ttpts')
            .data(picks)
            .transition()
            .attr('cx', function(d) {
            return xScale3(d.pick.t);
            })
            .attr('cy', function(d) {
            return yScale3(d.trace);
            })
            .attr('r', 5)
            .attr('class', 'ttpts')
            .attr('stroke', 'blue')
            .attr('fill', 'blue')
          */
          break;
        }

        switch (d3.event.key) {
        case 'z':
        case 'Z':
          var trange = tScale2.domain();
          var tlen = trange[1] - trange[0];
          var dir = d3.event.shiftKey ? 4 : 1; // zoom in or out?
          var tmin = Math.max(0, cursT - (dir * tlen / 4));
          var tmax = Math.min(dt * (npts - 1), cursT + (dir * tlen / 4));
          //console.log(d3.event.key, d3.event.shiftKey, trange, tlen, dir, cursT, tmin, tmax);
          tScale2.domain([tmin, tmax])
          focus.select('.y-axis')
            .call(tAxis2)
          focus.selectAll('.fline')
            .attr('d', function(d) {return focusLine(d.samps);})
          focus.selectAll('.ffills')
            .attr('d', function(d) {return focusArea(d.samps);})
          
          updateCursor();

          // only the y coordinate changes when 
          pickg
            .selectAll('.picks')
            .attr('y', function(d) {
              return tScale2(d.pickT);
            });

          break;
        }


        // 't' - zoom in to fewer traces (2 on either side of curr trace)
        // 'T' -  zoom out to all traces
        if (d3.event.key === 't') {
          ntrcsFoc = lastTrc - firstTrc + 1;
          firstTrc = Math.max(cursTrc - Math.floor(ntrcsFoc/4), 0);
          lastTrc = Math.min(cursTrc + Math.floor(ntrcsFoc/4), ntrcs);
          ntrcsFoc = lastTrc - firstTrc + 1;
          updateFocusLines();
          updateFocusAreas();

          updateCursor();

          r = vScale2.range()
          trchtFoc = Math.abs(r[0] - r[1]) / ntrcsFoc;

          console.log('picks', picks, r, trchtFoc)
          pickg
            .selectAll('.picks')
          //.data(picks)
          //.transition()
            .attr('x', function(d) {
              return vScale2(0) / ntrcsFoc - trchtFoc / 2;
            })
            .attr('width', trchtFoc)
            .attr('height', 2)
            .attr('transform', function(d) {
	      //              var trc = d.trace;
              xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
              return 'translate(' + xofsFoc + ',0)';
            })
        }
        if (d3.event.key === 'T') {
          firstTrc = 0;
          lastTrc = ntrcs - 1;
          ntrcsFoc = lastTrc - firstTrc + 1;
          console.log('trcs', cursTrc, firstTrc, lastTrc);
          updateFocusLines();
          updateFocusAreas();

          updateCursor();

          r = vScale2.range()
          trchtFoc = Math.abs(r[0] - r[1]) / ntrcsFoc;
          pickg
            .selectAll('.picks')
          //.data(picks)
          //.transition()
            .attr('y', function(d) {
              return tScale2(d.pickT);
            })
            .attr('x', function(d) {
              return vScale2(0) / ntrcsFoc - trchtFoc / 2;
            })
            .attr('width', trchtFoc)
            .attr('height', 2)
            .attr('transform', function(d) {
              xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
              return 'translate(' + xofsFoc + ',0)';
            })

        }
      });


    // focus.append('rect')
    //     .attr('class', 'overlay')
    //     .attr('width', w2)
    //     .attr('height', h2)
    //     .on('mouseover', function() {cursor.style('display', null);})
    //     .on('mouseout', function() {cursor.style('display', 'none');})
    //     .on('mousemove', function() {
    //  var m = d3.mouse(this);
    //  var mT = xScale2.invert(m[0]);
    //  var mY = yScale2.invert(m[1]);

    //  var x = m[0];
    //  var dom = yScale2.domain(), dl = dom[0] - dom[1];
    //  var trcnum = Math.floor(ntrcs * (mY - dom[1]) / dl);
    //  if(trcnum < 0) trcnum = 0;
    //  if(trcnum > ntrcs-1) trcnum = ntrcs - 1;
    //  var i = bisectT(mydata[trcnum], mT);
    //  var yofs = (h2/ntrcs * trcnum);

    //  console.log('mousemove', m, mY, dl, dom[0], dom[1], trcnum, i,yofs);
    //  //scope.mouseTime({d:mT}); // pass mouse time to controller
    //     });
  };

  return {
    link: link,
    restrict: 'E',
    scope: {
      data: '=',
      setpicks: '&'
    }
  }
}]);
