var fs = require('fs');
//var gui = require('nw.gui')
global.window = window;
global.gui = require('nw.gui');

var menu = require('./app/menu.js');
menu.initMenu();

console.log('after initmenu');

var sprintf = require('sprintf-js').sprintf;
var cryp = require('crypto');
var readSU = require('segy-js').readSU;
var fileio = require('./app/fileio.js')

//var app = angular.module('psqlApp', ['ng-fileDialog']);
var app = angular.module('psqlApp', []);

//app.controller('MainCtrl', ['$scope', '$interval', '$timeout', 'FileDialog', function($scope, $interval, $timeout, FileDialog) {
app.controller('MainCtrl', ['$scope', '$interval', '$timeout', function($scope, $interval, $timeout) {

  self = this;
  self.filename = null;
  self.msg = 'PSQL';

  var win = global.gui.Window.get();
  console.log(win.menu)
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
  console.log(filemenu, openmenu, savemenu)
  var dip;
  var pickedHdrs;

  openmenu.on('click', function() {
    var chooser = document.getElementById('openfile');
    //console.log(chooser);

    chooser.addEventListener('change', function() {
      var filepath = this.value;
      self.filename = filepath;
      console.log(filepath);
      dip = readSU(filepath);
      console.log(dip);
      self.data = dip;
      $scope.$apply();
    })
    chooser.click();
  });

  savemenu.on('click', function() {
    console.log('savemenu click');
    var chooser = document.getElementById('savefile');
    console.log(chooser);
    chooser.addEventListener('change', function() {
      var filepath = this.value;
      console.log(filepath);
      fs.writeFileSync(filepath, JSON.stringify(pickedHdrs));
    })
    chooser.click();
  });
  

  // from the directive
  self.setpicks = function(picks) {
    pickedHdrs = picks;
  }

  /*
    self.saveFile = function() {
    console.log('savefile called');
    FileDialog.saveAs(function(filename) {
    console.log('filename', filename);
    }, 'file.pks', '.pks')
    };
  */
  var wsURL = 'ws://localhost:9191/websocket';
  var ws = new WebSocket(wsURL);
  ws.onopen = function() {
    console.log('ws opened');
    ws.send('{"cmd":"getNodeFileTimes"}');
  };
  ws.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    console.log(msg);
  };

}]);

app.directive('d3Ricker', function() {
  function link(scope, element, attr) {
    //    var svgOuter = d3.select(element[0]).append('svg');
    var data = scope.data;

    /*
      scope.$watch('data', function(newval, oldval, scope) {
      console.log('data changed');
      data = scope.data
      }, true);
    */

    if (data === 'undefined') {
      return;
    } else {
      console.log('ok');
    }

    var el = element[0];
    var width = 900,
	height = 600;
    //    console.log(svgOuter.style('width'), svgOuter.style('height'));
    //    svgOuter
    //      .attr('width', width)
    //      .attr('height', height)

    //    console.log(svgOuter.style('width'), svgOuter.style('height'));
    //var ffididx = scope.ffididx;
    var ffids = scope.ffids;

    var dt = data.dt;
    // label traces with unique id
    data.traces.forEach(function(d) {
      d.id = cryp.randomBytes(5).toString('hex');
    });
    //console.log(traces[0], traces[1])

    var tracesByFFID = d3.nest()
	.key(function(d) {
          return d.ffid;
	})
	.entries(data.traces);
    // returns [{key:'0', values:[trc0, trc1, ...]}]

    var traces = tracesByFFID[0].values;
    var currFFID = tracesByFFID[0].key;
    var ffidIdx = 0;

    var pickedTraces = [];

    // add a "trace number within ensemble" header word
    for(var i=0; i<tracesByFFID.length; i++) {
      tracesByFFID[i].values.forEach(function(d,i) {
        d.tracens = i;
      });
    }
    console.log(tracesByFFID, currFFID);

    var firstTrc = 0,
	lastTrc = traces.length - 1;
    var ntrcs = traces.length;
    var npts = traces[0].samps.length;
    var traceLen = (npts - 1) * dt;

    var cursT = Math.floor(npts/2) * dt;
    cursTrc = Math.floor((lastTrc - firstTrc) / 2);

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

      
      cursorText = sprintf('ffid %s trace: %d time: %.3f value: %+.3f', currFFID, cursTrc, cursT, traces[cursTrc].samps[sampNo].v);
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

    var cursorText = sprintf('ffid %s trace: %d time: %.3f', currFFID, cursTrc, cursT);
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
      //console.log(s)
      //console.log(s.map(xScale.invert, xScale));
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

      updateCursor()
      
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
          // display next/prev ffid
        case 'N':
          console.log('N')
          ffidIdx = Math.min(tracesByFFID.length-1, ++ffidIdx);
          currFFID = tracesByFFID[ffidIdx].key;
          traces = tracesByFFID[ffidIdx].values;
          ntrcs = traces.length;
          console.log(traces, ntrcs, ffidIdx);

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
          ffidIdx = Math.max(0, --ffidIdx);
          traces = tracesByFFID[ffidIdx].values;
          ntrcs = traces.length;
          console.log(traces, ntrcs, ffidIdx);

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

          console.log(idx, pickedTraces);
          updatePicks();
          break;
          
          // pick the current value
        case 'p':
          var i = bisectT(traces[cursTrc].samps, cursT);
          var r = vScale2.range();
          var trchtFoc = (r[1] - r[0]) / ntrcsFoc;
          // am I re-picking?
          
          traces[cursTrc].pickT = cursT;
          traces[cursTrc].pickSamp = i;
          pickedTraces.push(traces[cursTrc]);
          scope.setpicks({picks: pickedTraces});
          console.log('pick', firstTrc, traces[cursTrc]);

          // draw the pick line
          pickg
            .selectAll('.picks')
            .transition()
            .attr('y', function(d) {
              return tScale2(d.pickT) - 1;
            })
          pickg
            .selectAll('.picks')
            .data(traces
                  .filter(function(d){return typeof d.pickT !== 'undefined';}), function(d) {return d.id;})
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
              xofsFoc = (w2 / ntrcsFoc * (d.tracens-firstTrc));
              console.log('pick enter',d, xofsFoc);
              return 'translate(' + xofsFoc + ',0)';
            })
            .attr('stroke', 'none')
            .attr('fill-opacity', 0.5)
            .attr('fill', 'black')
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

          // save data
        case 's':
        case 'S':
          console.log('picks', picks);
          savedata();
          break;
        }

        switch (d3.event.key) {
        case 'z':
        case 'Z':
          var trange = tScale2.domain();
          var tlen = trange[1] - trange[0];
          var dir = d3.event.shiftKey ? 4 : 1;
          var tmin = Math.max(0, cursT - (dir * tlen / 4));
          var tmax = Math.min(dt * (npts - 1), cursT + (dir * tlen / 4));
          console.log(d3.event.key, d3.event.shiftKey, trange, tlen, dir, cursT, tmin, tmax);
          tScale2.domain([tmin, tmax])
          focus.select('.y-axis')
            .call(tAxis2)
          focus.selectAll('.fline')
            .attr('d', function(d) {
              return focusLine(d.samps);
            })
          focus.selectAll('.ffills')
            .attr('d', function(d) {
              return focusArea(d.samps);
            })
          updateCursor()

          pickg
            .selectAll('.picks')
            .attr('y', function(d) {
              return tScale2(d.pickT);
            })

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
});
