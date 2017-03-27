angular.module('psqlApp')
.directive('d3Psd', [function() {
  function link(scope, element, attr) {
    var margins = {
      left: 50,
      right: 30,
      top: 30,
      bottom: 30
    },
	w = 400 - margins.left - margins.right,
	h = 300 - margins.top - margins.bottom;

    var data = scope.data;
    console.log('in d3 psd', data);
    var psd = []
    for(var i=0; i<data.psd.length; i++) {
      psd.push([data.freqs[i], data.psd[i]]);
    }
    //console.log(psd)
    var svg = d3.select(element[0])
	.append('svg')
	.attr('width', w + margins.left + margins.right)
	.attr('height', h + margins.top + margins.bottom)
	.append('g')
	.attr('transform', 'translate(' + margins.left + ',' + margins.top + ')');

    svg.append('g').attr('class', 'x-axis axis');
    svg.append('g').attr('class', 'y-axis axis');
    
    var fScale = d3.scaleLinear()
        .domain([d3.min(data.freqs), d3.max(data.freqs)])
        .range([0,w])
    var fAxis = d3.axisBottom(fScale);
    svg.select('.x-axis')
      .attr('transform', 'translate(0,' + h + ')')
      .call(fAxis.ticks(5))

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0-margins.left)
      .attr('x', 0-(h/2))
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('PSD (v*v/Hz)')
    svg.append('text')
      .attr('x', w/2)
      .attr('y', h)
      .attr('dy', '-1em')
      .style('text-anchor', 'middle')
      .text('Frequency (Hz)')


    
    var pScale = d3.scaleLog()
        .domain([d3.min(data.psd), d3.max(data.psd)])
        .range([h,0])
        .nice()
    var pAxis = d3.axisLeft(pScale);
    svg.select('.y-axis')
      .call(pAxis)

    var line = d3.line()
        .x(function(d) {return fScale(d[0]);})
        .y(function(d) {return pScale(d[1]);})

    var psdPlot = svg.append('g')
        .append('path')
        .attr('id', 'psdLine')
        .datum(psd)
        .attr('class', 'psd')
        .attr('d', line);

    scope.$watch('data', function() {
      data = scope.data;
      var psd = []
      for(var i=0; i<data.psd.length; i++) {
        psd.push([data.freqs[i], data.psd[i]]);
      }
      pScale
        .domain([d3.min(data.psd), d3.max(data.psd)])
        .nice()

      fScale
        .domain([d3.min(data.freqs), d3.max(data.freqs)])
      svg.select('.y-axis')
        .call(pAxis.ticks(5))
      svg.select('.x-axis')
        .call(fAxis.ticks(5))
      svg.select('#psdLine')
        .datum(psd)
        .attr('d', line);
    })

  };
  return {
    link: link,
    restrict: 'E',
    scope: {
      data: '=',
    }
  }
}]);
