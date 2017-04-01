/*                -*- indent-tabs-mode:nil; -*-
 * d3-ricker will generate 2 windows: the main and zoom windows
 * and allow picking
 */

/* jshint latedef:nofunc */
/*eslint-env node*/
/*global d3*/
/*eslint-no-undef: "error"*/
/*eslint no-console: ["error", {allow: ["log"]}]*/

angular.module('psqlApp')
  .directive('d3Seis', [function() {
    function link(scope, element, attr) {
      'use strict';

      // size of the focus window (500x600)
      var margins2 = {left: 50,right: 30,top: 30,bottom: 30},
        w2 = 800 - margins2.left - margins2.right,
        h2 = 600 - margins2.top - margins2.bottom;

      var data;
      var dt,traces, currEns, ensIdx, pickedTraces = [];
      var firstTrc, lastTrc, ntrcs, npts, cursI, cursT, cursTrc;
      var tracesByEnsemble;
      var displayScale = 1; // scale the traces in the "focus" panel by this

      /* init - label traces with unique id and sort */
      // generate the y- (time) scale for the main window
      var tmin, tmax;
      var tScale = d3.scaleLinear();
      var tScale2 = d3.scaleLinear();
      var oScale2 = d3.scaleLinear()
          .range([0,w2]);


      //console.log(data.traces);
      data = scope.data;
      init();

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

      // generate the y- (time) scale for the main window
      tmin = d3.min(traces[0].samps, function(d){return d.t;});
      tmax = d3.max(traces[0].samps, function(d){return d.t;});

      console.log('t', traces[0], tmin, tmax);

      /* the core of the display is here, and repeated 4 times - 2 sets
       * of `lines` in the main and focus windows, and 2 sets of
       * `areas`.  The logic is the same in all cases:
       * - .selectAll to get a set of lines
       * - .data "join" the selection with the traces
       *   (with the 2nd argument to make them unique with .id)
       * - draw the line with the 'd' attr.
       * - shift and shrink it to its right location
       */

      var focus = d3.select(element[0])
          .append('svg')
          .attr('width', w2 + margins2.left + margins2.right)
          .attr('height', h2 + margins2.top + margins2.bottom)
          .append('g')
          .attr('transform', 'translate(' + margins2.left + ',' + margins2.top + ')');

      var vScale2 = d3.scaleLinear().range([0, w2]);
      tScale2 = d3.scaleLinear().range([0, h2]);
      var oAxis2 = d3.axisTop(oScale2);

      tScale2.domain([tmin, tmax]);
      vScale2.domain([-1, 1]);

      var tAxis2 = d3.axisLeft(tScale2);

      // stolen from bl.ocks.org
      // gradient fill from -1 to 1
      // from 0->25%, red, from 25-50%, gradient from red to white, and so on.
      focus.append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('y1', 0).attr('x1', vScale2(-1))
        .attr('y2', 0).attr('x2', vScale2(1))
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
        .attr('stop-color', function(d) {return d.color;});

      // slightly different gradient (FIXME - needed?)
      // 0-50%, red->white, 50-100%, white->blue
      focus.append('linearGradient')
        .attr('id', 'focus-area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('y1', 0).attr('x1', vScale2(-1))
        .attr('y2', 0).attr('x2', vScale2(1))
        .selectAll('stop')
        .data([{'offset': '0%',color: 'red'},
               {'offset': '50%',color: 'white'},
               {'offset': '100%',color: 'blue'}])
        .enter()
        .append('stop')
        .attr('offset', function(d) {return d.offset;})
        .attr('stop-color', function(d) {return d.color;});

      /* Focus
       * plot the zoomed in data
       */

      var focusLine = d3.line()
      //        .curve(d3.curveMonotoneY)
          .x(function(d) { return vScale2(displayScale * d.v);})
          .y(function(d) { return tScale2(d.t);});

      var focusArea = d3.area()
          .y(function(d) {return tScale2(d.t);})
          .x0(vScale2(0))
      //        .curve(d3.curveMonotoneY)
          .x1(function(d) {return vScale2(displayScale * d.v);});



      var cursorText;
      var cText = focus.append('g')
          .append('text')
          .attr('id', 'ctext')
          .attr('class', 'ctext')
          .attr('transform', 'translate(' + w2 / 2 + ',' + (h2 + margins2.top) + ')')
          .text(cursorText);

      var cursor = focus.append('g')
          .style('display', null);
      cursor.append('circle')
        .attr('id', 'cursor')
        .attr('class', 'cursor')
        .attr('r', 6);
      //.attr('cy', tScale2(cursT))
      //.attr('cx', vScale2(displayScale * traces[cursTrc].samps[cursI].v) / ntrcsFoc)
      //.attr('transform', 'translate(' + xofsFoc + ',0)');

      /* mark line */
      var marks = [];
      var mark = focus.append('g')
          .attr('id', 'markPts');
      var markline = focus.append('g')
          .append('path')
          .attr('class', 'markline')
          .attr('id', 'markLine');
      var marklinefn = d3.line()
          .x(function(d){ return w2 / ntrcsFoc * (0.5 + d.tracens - firstTrc);})
          .y(function(d){ return tScale2(d.markT);});

      /* draw focus traces */

      focus.append('defs').append('clipPath')
        .attr('id', 'clip')
        .append('rect')
        .attr('width', w2)
        .attr('height', h2);

      var clipping = focus.append('g')
          .attr('clip-path', 'url(#clip)');

      //    console.log(vScale2.domain(), vScale2.range());
      firstTrc = 0;
      lastTrc = traces.length - 1;
      var ntrcsFoc = lastTrc - firstTrc + 1;
      var xofsFoc;


      var updateFocusLines = function() {
        ntrcsFoc = lastTrc - firstTrc + 1;
        console.log('update lines', lastTrc, firstTrc, ntrcsFoc);
        var l = d3.selectAll('.flineg')
            .selectAll('.fline')
            .data(traces.slice(firstTrc, lastTrc + 1), function(d) {
              return d.id;
            });
        // draw the current set of lines
        // update existing
        //      console.log(l);
        l.transition()
          .attr('d', function(d) {
            return focusLine(d.samps);
          })
          .attr('transform', function(d, i) {
            xofsFoc = (w2 / ntrcsFoc * i);
            //          console.log('update line',i, xofsFoc);
            return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
          });
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
          });
      };

      var updateFocusAreas = function() {
        ntrcsFoc = lastTrc - firstTrc + 1;
        var l = d3.selectAll('.fareag')
            .selectAll('.ffills')
            .data(traces.slice(firstTrc, lastTrc + 1), function(d) {
              return d.id;
            });
        l.attr('fill-opacity', function(d,i) {
          //          console.log('fill', i, cursTrc-firstTrc);
          return ((i===(cursTrc-firstTrc)) ? 1 : 0.3);
        })
          .attr('d', function(d) {return focusArea(d.samps);})
          .attr('transform', function(d, i) {
            xofsFoc = (w2 / ntrcsFoc * i);
            return 'translate(' + xofsFoc + ',0) scale(' + 1 / ntrcsFoc + ',1)';
          });
        l.enter()
          .append('path')
          .attr('class', 'ffills')
          .attr('d', function(d) {return focusArea(d.samps);})
          .attr('fill-opacity', function(d,i) {return ((i===(cursTrc-firstTrc)) ? 1 : 0.3);})
          .attr('transform', function(d, i) {
            xofsFoc = (w2 / ntrcsFoc * i);
            return 'translate(' + xofsFoc + ',0) scale(' +  1 / ntrcsFoc + ',1)';
          });
        l.exit().remove();
      };

      var fareag = clipping.append('g')
          .attr('class', 'fareag');
      updateFocusAreas();

      var flineg = clipping.append('g')
          .attr('class', 'flineg');
      updateFocusLines();
      focus.append('g')
        .attr('class', 'axis x-axis')
        .call(oAxis2.ticks(5));
      //      .call(vAxis2)
      focus.append('g')
        .attr('class', 'axis y-axis')
        .call(tAxis2);

      /* define the pick line vars */
      var pickg = focus.append('g');

      var updateCursor = function() {
        // redraw the cursor
        ntrcsFoc = lastTrc - firstTrc + 1;
        xofsFoc = (w2 / ntrcsFoc * (cursTrc - firstTrc));
        //sampNo = bisectT(traces[cursTrc].samps, cursT);
        cursT = traces[cursTrc].samps[cursI].t;
        //      console.log('updateCursor', xofsFoc, sampNo, cursI);
        cursor.select('#cursor')
          .attr('cy', tScale2(cursT))
          .attr('cx', vScale2(displayScale * traces[cursTrc].samps[cursI].v) / ntrcsFoc)
          .attr('transform', 'translate(' + xofsFoc + ',0)');

        cursorText = sprintf('ensemble %s trace: %d time: %.3f value: %+.3f',
					currEns, cursTrc, cursT, traces[cursTrc].samps[cursI].v * traces[cursTrc].ampscale);
        focus.select('#ctext')
          .text(cursorText);
      };

      var updatePicks = function() {
        // and the picks
        var r = vScale2.range();
        ntrcsFoc = lastTrc - firstTrc + 1;
        var trchtFoc = Math.abs(r[0] - r[1]) / ntrcsFoc;
        //      console.log(pickedTraces, currEns,
        //pickedTraces.filter(function(d){return d.ens==+currEns;}));
        // only choose those picks that are part of this ensemble
        // the +currEns converts "1" to 1
        var p = pickg.selectAll('.picks')
            .data(pickedTraces.filter(function(d){return d.ens===+currEns;}),
                  function(d) {return d.tracr;});

        //console.log('update picks', p);
        p.exit()
          .remove();
        p.transition()
          .duration(1000)
          .attr('y', function(d) {return tScale2(d.pickT);})
          .attr('x', vScale2(0)/ntrcsFoc - trchtFoc/2)
          .attr('width', trchtFoc)
          .attr('transform', function(d) {
            xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
            return 'translate(' + xofsFoc + ',0)';
          });

        p.enter()
          .append('rect')
          .attr('class', 'picks')
          .attr('y', function(d) {return tScale2(d.pickT);})
          .attr('x', vScale2(0)/ntrcsFoc - trchtFoc/2)
          .attr('width', trchtFoc)
          .attr('height', 2)
          .attr('transform', function(d) {
            xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
            return 'translate(' + xofsFoc + ',0)';
          });
      };

      cursT = traces[cursTrc].samps[cursI].t;
      xofsFoc = w2 / ntrcsFoc * (cursTrc - firstTrc);

      /* handle key interactions */
      var idx;
      d3.select('body')
        .on('keydown', function() {
          //console.log(d3.event.key, d3.event.code);
          // scale traces up and down
          if (d3.event.key === 'y' || d3.event.key === 'Y') {
            var scl = d3.event.shiftKey ? 0.5 : 2;

            displayScale *= scl;
            updateFocusLines();
            updateFocusAreas();
          }

          switch (d3.event.key) {
            // move cursor up/down
          case 'j':
          case 'k':
          case 'J':
          case 'K':
          case 'ArrowUp':
          case 'ArrowDown':

            // calculate the new cursor position
            var td = tScale2.domain();
            var tdlen = td[1] - td[0];
            var tdi = td.map(function(d) {return Math.floor(d/dt);});
            var tdilen10 = Math.floor((tdi[1] - tdi[0])/10);
            tdilen10 = tdilen10===0 ? 1 : tdilen10;

            var incr = d3.event.shiftKey ? tdilen10: 1;
            incr *= (d3.event.code === 'KeyK' || d3.event.code == 'ArrowUp') ? -1 : 1;
            cursI += incr;
            if(cursI<0) {cursI = 0;}
            if(cursI>=npts){cursI = npts-1;}
            cursT = traces[cursTrc].samps[cursI].t;

            // if it has moved off screen, recalculate the domain
            if (cursT <= td[0] || cursT >= td[1]) {
              if (cursT <= td[0]) {
                td[0] -= tdlen/4;
                if(td[0] < tmin) {td[0] = tmin;}
                td[1] = td[0] + tdlen - dt;
              } else {
                td[1] += tdlen/4;
                if(td[1] > tmax) {td[1] = tmax - dt;}
                td[0] = td[1] - tdlen + dt;
              }

              //console.log('td1',td);
              tScale2.domain(td);
              focus.select('.y-axis')
                .transition()
                .duration(1000)
                .ease(d3.easeQuad)
                .call(tAxis2);
              focus.selectAll('.fline')
                .transition()
                .duration(1000)
                .ease(d3.easeQuad)
                .attr('d', function(d) {
                  return focusLine(d.samps);
                });
              focus.selectAll('.ffills')
                .transition()
                .duration(1000)
                .ease(d3.easeQuad)
                .attr('d', function(d) {
                  return focusArea(d.samps);
                });
              updatePicks();
            }
            // and redraw the cursor
            updateCursor();
            break;

            // move cursor to prev/next trace
          case 'h':
          case 'l':
          case 'H':
          case 'L':
          case 'ArrowLeft':
          case 'ArrowRight':
            //            console.log('hl key', d3.event.code, d3.event.shiftKey, cursTrc, firstTrc, lastTrc);
            // calculate the new trace for the cursor
            var trcincr = d3.event.shiftKey ? 10 : 1;
            trcincr *= (d3.event.code === 'KeyL' || d3.event.code === 'ArrowRight') ? 1 : -1;
            cursTrc = Math.min(cursTrc + trcincr, lastTrc);
            cursTrc = Math.max(cursTrc, firstTrc);

            //var i = bisectT(traces[cursTrc].samps, cursT);
            xofsFoc = (w2 / ntrcsFoc * (cursTrc - firstTrc));
            //console.log('jk key', d3.event.code, d3.event.shiftKey, cursTrc, firstTrc, lastTrc, i, xofsFoc);

            updateCursor();

            // make the cursor-trace opaque and dim other traces
            fareag.selectAll('.ffills')
              .attr('fill-opacity', function(d,i) {
                //                console.log('hl', i, cursTrc, firstTrc);
                return ((i===cursTrc-firstTrc) ? 1 : 0.3);
              });
            break;

            // remove the current pick
          case 'd':
            // search for this trc in the pickedtraces
            // use the globally unique tracr header (FIXME-is this true?)
            idx = pickedTraces.map(function(d) {return d.tracr;})
              .indexOf(traces[cursTrc].tracr);
            if(idx >= 0) {pickedTraces.splice(idx,1);} // remove it

            // console.log(idx, pickedTraces);
            updatePicks();

            // tell the controller about the changes.
            scope.setpicks({picks: pickedTraces});
            break;

            // pick the current value
          case 'p':
            var r = vScale2.range();
            ntrcsFoc = lastTrc - firstTrc + 1;
            var trchtFoc = (r[1] - r[0]) / ntrcsFoc;

            var trc = traces[cursTrc];
            var pickT = trc.samps[cursI].t;
            var pickVal = trc.samps[cursI].v;
            var zc0 = -1, zc1 = -1, zc2 = -1, zc3=0;
            // If a pulse is xxx + - - - - + + + + + - - - - + xxx
            // zero crossings are:        0       1         2       3
            // search backwards for zc1 and then backwards for zc0
            for(var j=cursI; j>cursI-100; j--) {
              if(trc.samps[j].v *  pickVal < 0) {
                zc1 = j;
                for(var k=zc1; k>zc1-100; k--) {
                  if(trc.samps[k].v * pickVal > 0) {
                    zc0 = k;
                    break;
                  }
                }
                break;
              }
            }
            for(var j=cursI; j<cursI+100; j++) {
              if(trc.samps[j].v *  pickVal < 0) {
                zc2 = j;
                for(var k=zc2; k<zc1+100; k++) {
                  if(trc.samps[k].v * pickVal > 0) {
                    zc3 = k;
                    break;
                  }
                  break;
                }
              }
            }
            var pkmaxI = null,
              pkmax;
            if(zc1 > 0 && zc2 > 0) {
              var local = trc.samps.slice(zc1, zc2);
              // scan finds index of peak
              var localIdx = d3.scan(local, function(a,b){return b.v-a.v;});
              pkmax = local[localIdx];
              pkmaxI = localIdx + zc1;
            }

            //      console.log(pickVal, cursI, cursT, zc0, zc1, zc2, zc3, pkmaxI, pkmax);
            console.log(pickVal, cursI, cursT, trchtFoc);

            var ampscale = trc.ampscale;
            // deep copy of trc.samps (other methods only copy a reference)
            var samps = JSON.parse(JSON.stringify(trc.samps.slice(cursI-100, cursI+100)));
            samps.forEach(function(d){d.v *= ampscale;});
            var newpk = {
              ffid: trc.ffid,
              offset: trc.offset,
              tracr: trc.tracr,
              id: trc.id,
              // used to plot the pick in x
              tracens: trc.tracens,
              ens: trc.ffid,
              pickT: pickT,
              pickIdx: cursI,
              pickVal: trc.samps[cursI].v * ampscale,
              autopickIdx: pkmaxI,
              autopickVal: pkmax.v * ampscale,
              autopickT: pkmax.t,
              // copy the 100 samps around the pick?
              samps: samps
            };

            // am I re-picking?  Search for cursTrc id in pickedTraces
            // that is unique even if offset or tracr etc aren't set?
            idx=-1;
            var id=trc.id;
            idx = pickedTraces.map(function(d) {return d.id;})
              .indexOf(id);
            if (idx >= 0) { // found it...
              pickedTraces[idx] = newpk;
            } else { // new pick
              pickedTraces.push(newpk);
            }
            /* sort...*/
            pickedTraces.sort(function(a,b) {return a.tracens - b.tracens;});

            console.log(pickedTraces);
            // tell the controller about it...
            scope.setpicks({picks: pickedTraces});
            //console.log('pick', firstTrc, pickedTraces);

            /* draw a "mark" line between picks */
            var bisectM = d3.bisector(function(d) {return d.tracens;}).left;
            marks = [];
            for(var i=0; i<traces.length; i++) {
              trc = traces[i];
              var mIdx = bisectM(pickedTraces, trc.tracens);
              var mT;
              //console.log(trc, mIdx)
              if (mIdx === 0) { /* trace is to left of first pick */
                mT = pickedTraces[0].pickT;
              } else if (mIdx === pickedTraces.length) {
                mT = pickedTraces[pickedTraces.length-1].pickT;
              } else {
                var pkleft = pickedTraces[mIdx-1];
                var pkright = pickedTraces[mIdx];
                mT = pkleft.pickT + (trc.tracens - pkleft.tracens) * (pkright.pickT-pkleft.pickT)/(pkright.tracens-pkleft.tracens);
              }
              //console.log(mT);
              var m = {
                markT:mT,
                id:trc.id,
                tracens: trc.tracens,
                ffid: trc.ffid
              };
              marks.push(m);
            }

            //focus
            //  .selectAll('#markLine')
            //  .datum(marks)
            //  .attr('d', marklinefn);

            pickg
              .selectAll('.picks')
              .data(pickedTraces, function(d) {return d.id;})
              .enter()
              .append('rect')
              .attr('class', 'picks')
              .attr('y', function(d) {return tScale2(d.pickT);})
              .attr('x', vScale2(0)/ntrcsFoc - trchtFoc/2)
              .attr('width', trchtFoc)
              .attr('height', 2)
              .attr('transform', function(d) {
                xofsFoc = (w2 / ntrcsFoc * (d.tracens-firstTrc));
                //console.log('pick enter',d, xofsFoc);
                return 'translate(' + xofsFoc + ',0)';
              })
              .attr('stroke', 'none')
            //            .attr('fill-opacity', 0.5)
              .attr('fill', 'cyan');
            //.on('mouseover', handleMouseoverPick)
            //.on('mouseout', handleMouseoutPick);
            // update the pick line (if this is a re-pick)
            pickg
              .selectAll('.picks')
              .transition()
              .attr('y', function(d) {
                //console.log('update',d, d.pickT);
                return tScale2(d.pickT);
              });
            // or draw a new one.

            break;
          }

          switch (d3.event.key) {
          case 'z':
          case 'Z':
            // calculate the new time domain and reset the axis
            var trange = tScale2.domain();
            var tlen = trange[1] - trange[0];
            var dir = d3.event.shiftKey ? 4 : 1; // zoom in or out?
            var tmn = Math.max(tmin, cursT - (dir * tlen / 4));
            var tmx = Math.min(tmax, cursT + (dir * tlen / 4));
            //console.log(d3.event.key, d3.event.shiftKey, trange, tlen, dir, cursT, tmin, tmax);
            tScale2.domain([tmn, tmx]);
            focus.select('.y-axis')
              .call(tAxis2);
            focus.selectAll('.fline')
              .attr('d', function(d) {return focusLine(d.samps);});
            focus.selectAll('.ffills')
              .attr('d', function(d) {return focusArea(d.samps);});

            updateCursor();

            // only the y coordinate changes when zoom in time
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
            // calculate the new range of traces and redraw everything
            ntrcsFoc = lastTrc - firstTrc + 1;
            if(ntrcsFoc <= 8) {return;}
            firstTrc = Math.max(cursTrc - Math.floor(ntrcsFoc/4), 0);
            lastTrc = Math.min(cursTrc + Math.floor(ntrcsFoc/4), ntrcs-1);
            ntrcsFoc = lastTrc - firstTrc + 1;
            updateFocusLines();
            updateFocusAreas();

            updateCursor();
            //r = oScale2.range();
            //          trchtFoc = Math.abs(r[0] - r[1]) / ntrcsFoc;
            trchtFoc = w2 / ntrcsFoc;

            //console.log('t', firstTrc, lastTrc)
            oScale2.domain([traces[firstTrc].offset, traces[lastTrc].offset]);
            oScale2.range([0 + trchtFoc/2, w2 - trchtFoc/2]);
            focus.select('.x-axis')
              .call(oAxis2.ticks(5));
            //          r = vScale2.range()

            //console.log('picks', picks, r, trchtFoc)
            updatePicks();
          }
          if (d3.event.key === 'T') {
            firstTrc = 0;
            lastTrc = ntrcs - 1;
            ntrcsFoc = lastTrc - firstTrc + 1;
            //console.log('trcs', cursTrc, firstTrc, lastTrc);
            updateFocusLines();
            updateFocusAreas();
            updateCursor();

            //r = oScale2.range();
            //          trchtFoc = Math.abs(r[1] - r[0]) / ntrcsFoc;
            trchtFoc = w2 / ntrcsFoc;

            oScale2.domain([traces[firstTrc].offset, traces[lastTrc].offset]);
            oScale2.range([0 + trchtFoc/2, w2 - trchtFoc/2]);
            //    oScale2.range([r[0] + trchtFoc/2, r[1] - trchtFoc/2])
            focus.select('.x-axis')
              .call(oAxis2.ticks(5));

            pickg
              .selectAll('.picks')
            //.data(picks)
            //.transition()
              .attr('y', function(d) {return tScale2(d.pickT);})
              .attr('x', vScale2(0) / ntrcsFoc - trchtFoc / 2)
              .attr('width', trchtFoc)
              .attr('height', 2)
              .attr('transform', function(d) {
                xofsFoc = (w2 / ntrcsFoc * (d.tracens - firstTrc));
                return 'translate(' + xofsFoc + ',0)';
              });
          }
        });

      // TODO - on mouseover of pick, display pick info?
      /*
	function handleMouseoverPick(d,i) {
        console.log('mouseover', d, i);
	}
	function handleMouseoutPick(d, i) {
        console.log('mouseover', d, i);
	}
      */

      //console.log('t', traces[0], tmin, tmax);
      function init () {
        // Label traces with unique id <ffid>_<trace_in_ensemble>
        //data.traces.forEach(function(d, i) {
        //d.id = cryp.randomBytes(5).toString('hex');
        //d.id = d.ffid + '_' + i;
        //d.tracens = i;
	//});
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

        tmin = d3.min(traces[0].samps, function(d){return d.t;});
        tmax = d3.max(traces[0].samps, function(d){return d.t;});
        tScale.domain([tmin, tmax]);
        tScale2.domain([tmin, tmax]);

        // add a "trace number within ensemble" header word
        // and uniquify the trace by labeling with <ffid>_tracens
        for(var i=0; i<tracesByEnsemble.length; i++) {
          tracesByEnsemble[i].values.forEach(function(d,i) {
            d.tracens = i;
            d.id = d.ffid + '_' + i; // a string
          });
        }
        //console.log('ens', tracesByEnsemble, currEns);

        firstTrc = 0;
        lastTrc = traces.length - 1;
        ntrcs = traces.length;
        npts = traces[0].samps.length;

        cursI = Math.floor(npts/2);
        cursT = traces[0].samps[cursI].t;
        cursTrc = Math.floor((lastTrc - firstTrc) / 2);
        oScale2.domain([traces[firstTrc].offset, traces[lastTrc].offset]);
      }

      scope.$watch('data', function() {
        console.log(data);
        data = scope.data;
        init();

        // update all...
        updateFocusLines();
        updateFocusAreas();
        updateCursor();
        updatePicks();
      });

    }

    return {
      link: link,
      restrict: 'E',
      scope: {
        data: '=',
        setpicks: '&'
      }
    };
  }]);
