var  TT = {version: "0.0.1"};
  
  TT.crossfilter = function() {
	
	if(!TT.crossfilter.id) TT.crossfilter.id = 0;
	
	var cf = crossfilter(),
		charts = [],
		data,
		div ,
		filters = [],
		id = TT.crossfilter.id++,
		initialised = false,
		me = {};
		
	var p = {
		view: {
			width: 400,
			height: 200
		}
	};
	
	// Global functions
	
	// reset function
	window.cf_reset = function(i) {
		charts[i].filter(null);
		renderAll();
	};
	
	
	// Private functions

	function drawChart(filter) {
		
		var chart = new BarChart()
			.dimension(filter.dimension)
			.group(filter.group)
			.title(filter.title);
		
		
		if(filter.isDate) {
		
			chart.x(
				d3.time.scale()
					.domain([filter.min, filter.max])
					.rangeRound( [0, p.view.width] )
			);
			
		} else {
			
			chart.x( d3.scale.linear()
				.domain( [filter.min, filter.max] )
				.rangeRound( [0, p.view.width] ) 
			);
			
		}
		
		charts.push(chart);

		div.call(chart);

		chart.on("brush", renderAll)
			.on("brushend", renderAll);
	}
	
	function renderAll() {
	
		for( var i = 0; i < charts.length; i++) {
			charts[i].drawChart();
		}
		
		if(me.hasOwnProperty("publish") && charts[0]) {		
			me.publish(charts[0].dimension().top(999999));
		}
	}

	// Initialiser
	
	me.apply = function() {
		
		div = arguments[0];
		
		for(var i = 0; i < filters.length; i++) {
			drawChart( filters[i] );
		}
		
		initialised = true;
		
	};
	
	// Methods
	
	me.addFilter = function(params) {
		
		var filter = {};
		
		filter.title = params.title || params.dimension.toString();
		
		if(typeof params.dimension === "string") {
		
			filterFunction = function(d) {
				return d[params.dimension];
			};
			
		} else if (typeof params.dimension === "function") {

			filterFunction = params.dimension;

		} else {
			return false;
		}
	
		filter.dimension = cf.dimension(filterFunction);
		
		filter.group = filter.dimension.group(params.group);
		

		filter.min = d3.min( data, filterFunction );
		filter.max = d3.max( data, filterFunction );
		
		filter.isDate = (filter.min instanceof Date);
		
		filters.push(filter);
		
		if(initialised) {
			drawChart(filter);
		}		
		return me;
	};
	
	// Accessors
	
	me.charts = function() {
		
		return charts;
		
	};
	
	me.data = function(_) {
		if( !arguments.length ) return data;
		data = _;
		
		cf.remove();
		cf.add(data);
		
		return me;
	};
	
	me.filters = function() {
		
		return filters;
		
	};
	
	return me;
	
	
	// -- BarChart


	function BarChart() {
		
		if(!BarChart.id) BarChart.id = 0;
		
		var div,
			me = {},
			x,
			y = d3.scale.linear().range([100, 0]),
			id = BarChart.id++,
			axis = d3.svg.axis().orient("bottom"),
			axisHeight = 20,
			brush = d3.svg.brush(),
			brushDirty,
			dimension,
			group,
			round,
			title,
			svg;
	
		// Brush
		function initBrush() {
		
		brush.on( "brushstart.chart", function() {
			
			var div = d3.select(this.parentNode.parentNode.parentNode);
			
			div.select(".title a")
				.style("display", null);
			
		} );
		
		brush.on( "brush.chart", function() {
			
			var g = d3.select(this.parentNode),
				extent = brush.extent();
				
			if(round) {
				g.select(".brush")
					.call(brush.extent(extent = extent.map(round)));
			}		
			
			g.select("#clip-" + id + " rect")
				.attr("x", x(extent[0]))
				.attr("width", x(extent[1]) - x(extent[0]));
				
			dimension.filterRange(extent);
			
		} );
		
		brush.on( "brushend.chart", function() {
				
				if(brush.empty()) {
					
					var div = d3.select(this.parentNode.parentNode.parentNode);
					
					div.select(".title a")
						.style("display", "none");
						
					div.select("#clip-" + id + " rect")
						.attr("x", null)
						.attr("width", "100%");
						
					dimension.filterAll();
					
				}
				
			} );
		}
	
		// Initialiser
		
		me.apply = function() {
			
			div = arguments[0];
			
			div = div.append("div")
				.attr("id", "barChart_" + id)
				.attr("class", "chart");
				
			initBrush();
			me.drawChart();
			
		};
	
		// Methods
		me.drawChart = function() {
		
			function barPath(groups) {
					
				var path = [],
					i = -1,
					n = groups.length,
					d;
					
				// Generate path part per value				
				while (++i < n) {
					
					d = groups[i];
					
					path.push("M", x(d.key), ",", height, "V", y(d.value), "h9V", height);
					
				}
				
				return path.join("");
				
			}
			
			function drawChartSkeleton() {
				// Add title 
				div.append("div")
					.attr("class", "title")
					.text(title)		
					
				// Add reset link
				.append("a")
					.attr("onclick", "cf_reset(" + id + ")")
					.attr("class", "reset")
					.text("reset")
					.style("display", "none");
					
				// Append SVG element
				g = div.append("svg")
						.attr("width", width)
						.attr("height", height + axisHeight)
					.append("g");
					
				// Append clipping path for highlighting selection
				g.append("clipPath")
					.attr("id", "clip-" + id)
					.append("rect")
					.attr("width", width)
					.attr("height", height);
					
				// Append paths for data
				g.selectAll(".bar")
					.data( ["background", "foreground"] )
				.enter()
					.append("path")
					.attr("class", function(d) {
							return d + " bar";
						})
					.datum(group.all());
					
				// Apply clipping path to foreground path
				g.selectAll(".foreground.bar")
					.attr("clip-path", "url(#clip-" + id + ")");
					
				// Append axis
				g.append("g")
					.attr("class", "axis")
					.attr("transform", "translate(0, " + height + ")")
					.call(axis);
					
				// Initialise brush component
				var gBrush = g.append("g")
					.attr("class", "brush")
					.call(brush);
					
				gBrush.selectAll("rect")
					.attr("height", height);
			}
					
			var width = x.range()[1];
			var height = y.range()[0];
			
			y.domain( [0, group.top(1)[0].value] );
			
			var g = div.select("g");
			
			// Create the skeletal chart
			if( g.empty() ) {
				
				drawChartSkeleton();
				
			}
			
			if(brushDirty) {
			
				brushDirty = false;
				g.selectAll(".brush")
					.call(brush);
				
				// Display reset button if brush is usde
				div.select(".title a")
					.style("display", brush.empty() ? "none" : null);
				
				// Adjust clipping area
				if( brush.empty() ) {
				
					g.selectAll("#clip-" + id + " rect")
						.attr("x", 0)
						.attr("width", width);
						
				} else {
					
					var extent = brush.extent();
					g.selectAll("#clip-" + id + " rect")
						.attr( "x", x(extent[0]) )
						.attr( "width", x(extent[1]) - x(extent[0]) );
							
				}
			}
			
			g.selectAll(".bar").attr("d", barPath);
		
			
		};
		
		// Accessors
		
		me.dimension = function(_) {
			if (!arguments.length) return dimension;
			dimension = _;
			return me;
		};
		
		me.filter = function(_) {
			if (_) {
				brush.extent(_);
				dimension.filterRange(_);
			} else {
				brush.clear();
				dimension.filterAll();
			}
			brushDirty = true;
			return me;
		};
		
		me.group = function(_) {
			if (!arguments.length) return group;
			group = _;
			return me;
		};
			
		me.round = function(_) {
			if (!arguments.length) return round;
			round = _;
			return me;
		};
		
		me.title = function(_) {
			if (!arguments.length) return title;
			title = _;
			return me;
		};
		
		me.x = function(_) {
			if(!arguments.length) return x;
			x = _;
			axis.scale(x);
			brush.x(x);
			return me;
		};
		
		me.y = function(_) {
			if (!arguments.length) return y;
			y = _;
			return me;
		};
		
		
		return d3.rebind(me, brush, "on");
	}
};
/*

Generates Timeline view on array of data

data format: {

	id: "",
	from: Date(),
	to: Date(),
	title: "",
	weight: #

}


*/

TT.timeline = function() {
	
	if(!TT.timeline.id) TT.timeline.id = 0;
	
	var	initialised = false,
		id = TT.timeline.id++,
		me = {},
		timeline = this,
		zoom;
		
	var p = {
		
		axis: {},
		
		data: [],
		
		elements: {},
		
		format: {
			
			year: d3.time.format("%Y"),
			date: d3.time.format("%d %b %Y")
			
		},
		
		scales: {
			
			minMax: {
				
				// Used for semantic zooming
				
				weight: d3.scale.linear()
					.domain( [0, 1] )
					.range( [0, 1] ),
					
				works: d3.scale.linear()
					.domain([0, 1])
					.range([0, 1]),
				
				// Update zoom extent here
				
				zoom: d3.scale.linear()
					.domain( [0.01, 12] ) 
					.range( [0, 1] )
				
			}
			
		},
		
		styles: {
			
			events: {
				height: 14,
				fontSize: 12,
				margin: 1,
				padding: 2
			}
		},
		
		thresholds: {
			
			collapseLevel: 0.8,
			displayLevel: 0.6	
			
		},
		
		view: {
			
			from: new Date( 1800 , 0, 1 ),
			to: new Date( 2020 , 0, 1 ),
			
			width: 800,
			height: 600,
			padding: 40,
			ys: [0]
			
		},
		
		zoomFactor: 1
		
		
	};
	
	var attr = {
		
		axis: {
			tickFormat: function(d) {
				if( Math.round( (p.axis.scale().domain()[1].getFullYear() - p.axis.scale().domain()[0].getFullYear()) / p.axis.ticks()) >= 1 ) { // If there is not more than one tick per year represented
					return p.format.year(d);
				} else {
					return p.format.date(d);
				}
			}
		},
		
		event: {
		
			rect: {
				height: function(d) {
						return Math.min(d.height * p.zoomFactor, d.height) + "px";	
				},
				width: function(d) {
					return (d.width * p.zoomFactor) + "px";
				}
			},
			
			text: {
			
				anchor: function(d) {		
					return p.zoomFactor >= p.thresholds.collapseLevel && d.width * p.zoomFactor > d.title.length * p.styles.events.fontSize ? "start" : "end";	
				},
				
				display: function(d) {
					return d.renderLevel > p.thresholds.collapseLevel ? "block" : "none";	
				},
				
				x: function (d) {
					return (d.width * p.zoomFactor > d.title.length * p.styles.events.fontSize) ? (x(d.x) < 0 && x(d.x) + d.width * p.zoomFactor > 0 ? p.styles.events.padding + -1*x(d.x) : p.styles.events.padding) : -p.styles.events.padding;
				},
				
				y: p.styles.events.height * 0.75
			},
			
			transform: function (d)  {
				return "translate(" + x(d.x) + "," + (d.y + y(0)) + ")";
			}
		},

	};
			
	// Init scales used for panning and zooming
	var x = d3.scale.linear()
		.domain([0, p.view.width])
		.range([0, p.view.width ]);
	
	var y = d3.scale.linear()
		.domain([0, p.view.height])
		.range([0, p.view.height]);
		
	// Private functions
	
	function doZoom() {
		
		p.zoomFactor = d3.event.scale;
		
		var events = p.elements.events.selectAll("g.timeline_event");
		var ax = p.svg.select(".timeline_axis");
		
		p.scales.axis.domain( [ p.scales.pxToDate( x.domain()[0] ), p.scales.pxToDate( x.domain()[1] ) ] );
		
		update();
		
		ax.call(p.axis);
		
	}
	
	function update() {
		
		function createEventsUppearance(events) {
			
			// 
			events.append("rect")
				.attr("x", 0)
				.attr("y", 0)
				.attr("height", attr.event.rect.height)
				.attr("width", attr.event.rect.width)
				.attr("class", "eventRect");
					
			// Add event text
			events.append("text")
				.attr("class", "title")
				.text( function(d) { return d.title; } )
				.attr("x", attr.event.text.x)
				.attr("y", attr.event.text.y)
				.attr("text-anchor", attr.event.text.anchor)
				.attr("display", attr.event.text.display);
				
		}
		
		function filterEvents(d) { 
		
			/*
			
			Remove data
			- If the render level is below the display level
			- If the item is completely outside of the viewable area
			
			*/
		
			return d.renderLevel > p.thresholds.displayLevel  &&
				x(d.x) + d.width * p.zoomFactor >= 0 &&
				x(d.x) <= p.view.width &&
				d.y + y(0) > -p.styles.events.height && 
				d.y + y(0) < p.view.height;
				
		}
				
		function updateDataValues() {
				
			function computeRenderLevel(data, attribute) {
				
				if(data.totalWorks) {
					return Math.pow( p.scales.minMax.works(data.totalWorks), 0.02 / p.scales.minMax.zoom(p.zoomFactor) ) + p.scales.minMax.zoom(p.zoomFactor); 
				} else {
					return 0;
				}

		
			}

			p.data.forEach(function(d) {
			
				d.renderLevel = computeRenderLevel(d);
				
			});
			
			var count = 0;
			
			p.data.forEach(function(d) {	
			
				if( d.renderLevel > p.thresholds.displayLevel ) {
				
					d.x = p.scales.dateToPx(d.from.valueOf());
					d.width = ( p.scales.dateToPx(d.to.valueOf()) - p.scales.dateToPx(d.from.valueOf()) );
					
					d.height = d.renderLevel < p.thresholds.collapseLevel ? 1 : p.styles.events.height;
					d.margin = d.renderLevel < p.thresholds.collapseLevel ? 1 : p.styles.events.margin;
					
					if(count === 0) {
					
						d.y = p.view.padding;
						
					} else {
					
						d.y = p.view.ys[count - 1] + d.margin;
						
					}
					
					p.view.ys[count] = d.y + d.height;
					
					count++;
					
				} 
				
				/*
				else {
				
					d.x = p.scales.dateToPx(d.from.valueOf());
					d.width = (p.scales.dateToPx(d.to.valueOf()) - p.scales.dateToPx(d.from.valueOf()));
								
					d.height = 1;
					d.margin = 1;
					
					if(count === 0) {
						d.y = p.view.padding;
					} else {
						d.y = p.view.ys[count - 1] + d.margin;
					}
					
				}
				*/
			});
		}
		
		function updateEventsAppearance(events) {
			
			events.select("rect.eventRect")
				.attr("width", attr.event.rect.width)
				.attr("height", attr.event.rect.height);
				
			events.select("text.title")
				.attr("x", attr.event.text.x)
				.attr("y", attr.event.text.y)
				.attr("text-anchor", attr.event.text.anchor)
				.attr("display", attr.event.text.display);
				
		}
		
		updateDataValues();
		
		var events = p.elements.events.selectAll("g.timeline_event")
			.data(p.data.filter(filterEvents), function(d) { return d.id; });
			
		// Update events
		events.attr("transform", attr.event.transform);
		
		// Update event appearace
		updateEventsAppearance(events);
		
		// Add new events
		var eventsEnter = events.enter()
			.append("g")
				.attr("id", function(d) {
					return "tl" + id + "_event_" + d.id;
				})
			.attr("class", "timeline_event")
			.attr("transform", attr.event.transform);
	
		// Add event appearance
		createEventsUppearance(eventsEnter);
			
		// Remove events
		events.exit().remove();
		
		
	}
	
	function updateMinMax() {
		
		// Updates the scales used for semantic zooming
		p.scales.minMax.works.domain([ d3.min( p.data, function(d) {return d.totalWorks ? d.totalWorks : 0;} ), Math.min(300, d3.max( p.data, function(d) {return d.totalWorks ? d.totalWorks : 0;} )) ]);
		
	}

	// Initialiser
	me.apply = function () {
		
		function initTimeline() {
			
			function initAxis() {
			
				p.scales.axis = d3.time.scale()
					.domain( [ p.scales.pxToDate( x.domain()[0] ), p.scales.pxToDate( x.domain()[1] ) ] )
					.range( [0, p.view.width] );
				
				p.axis = d3.svg.axis()
					.scale(p.scales.axis)
					.tickSize(p.view.height - p.view.padding)
					.tickFormat(attr.axis.tickFormat)
					.orient("top");
					
				p.elements.axis = p.svg.append("g")
					.attr("class", "timeline_axis")
					.attr("id","tl" + id + "_axis")
					.call(p.axis)
					.attr("transform", "translate(0," + ( p.view.height - p.view.padding / 2 ) + ")");
					
			}
			
			function initEvents() {
			
				p.elements.events = p.svg.insert("g")
					.attr("class", "timeline_events")
					.attr("id", "tl" + id + "_events");
					
			}
				
			function initScales() {
			
				p.scales.dateToPx = d3.scale.linear()
					.domain( [ p.view.from.valueOf(), p.view.to.valueOf() ] )
					.range( [ p.view.padding, p.view.width - p.view.padding ] );
					
				p.scales.pxToDate = d3.scale.linear()
					.domain( [ p.view.padding, p.view.width - p.view.padding ] )
					.range( [ p.view.from.valueOf(), p.view.to.valueOf() ] );
					
			}	
			
			function initZoom() {						
				
				zoom = d3.behavior.zoom()
					.x(x)
					.y(y)
					.scaleExtent( p.scales.minMax.zoom.domain() );
									
				p.svg.select(".timeline_events").insert("rect",":first-child")
					.attr("width", p.view.width)
					.attr("height", p.view.height)
					.attr("class","overlay");
					
				p.svg.select(".timeline_events").call( zoom.on("zoom", doZoom) );
				
			}
			
							
			initScales();
			initEvents();
			initAxis();
			initZoom();	
			
		}
		
		// Update parameters
		
		p.svg = arguments[0];

		p.view.width = p.svg.attr("width");
		p.view.height = p.svg.attr("height");
		
		if(p.data) {
			
			p.view.from = d3.min( p.data, function(d) { return d.from; } );
			p.view.to = d3.max( p.data, function(d) { return d.to; } );
			
		}
		
		initTimeline();
		updateMinMax();
		update();
		
		initialised = true;
	};
	
	// Accessors
	me.data = function(_) {
		if( !arguments.length ) return p.data;
		p.data = _;
		
		if(initialised) {
			updateMinMax();
			update();
		}
		
		return me;
	};
	
	return me;
	
};!function(r){function n(r){return r}function t(r,n){for(var t=0,e=n.length,u=Array(e);e>t;++t)u[t]=r[n[t]];return u}function e(r){function n(n,t,e,u){for(;u>e;){var f=e+u>>>1;r(n[f])<t?e=f+1:u=f}return e}function t(n,t,e,u){for(;u>e;){var f=e+u>>>1;t<r(n[f])?u=f:e=f+1}return e}return t.right=t,t.left=n,t}function u(r){function n(r,n,t){for(var u=t-n,f=(u>>>1)+1;--f>0;)e(r,f,u,n);return r}function t(r,n,t){for(var u,f=t-n;--f>0;)u=r[n],r[n]=r[n+f],r[n+f]=u,e(r,1,f,n);return r}function e(n,t,e,u){for(var f,o=n[--u+t],i=r(o);(f=t<<1)<=e&&(e>f&&r(n[u+f])>r(n[u+f+1])&&f++,!(i<=r(n[u+f])));)n[u+t]=n[u+f],t=f;n[u+t]=o}return n.sort=t,n}function f(r){function n(n,e,u,f){var o,i,a,c,l=Array(f=Math.min(u-e,f));for(i=0;f>i;++i)l[i]=n[e++];if(t(l,0,f),u>e){o=r(l[0]);do(a=r(c=n[e])>o)&&(l[0]=c,o=r(t(l,0,f)[0]));while(++e<u)}return l}var t=u(r);return n}function o(r){function n(n,t,e){for(var u=t+1;e>u;++u){for(var f=u,o=n[u],i=r(o);f>t&&r(n[f-1])>i;--f)n[f]=n[f-1];n[f]=o}return n}return n}function i(r){function n(r,n,u){return(N>u-n?e:t)(r,n,u)}function t(t,e,u){var f,o=0|(u-e)/6,i=e+o,a=u-1-o,c=e+u-1>>1,l=c-o,v=c+o,s=t[i],h=r(s),d=t[l],p=r(d),g=t[c],y=r(g),m=t[v],x=r(m),b=t[a],A=r(b);h>p&&(f=s,s=d,d=f,f=h,h=p,p=f),x>A&&(f=m,m=b,b=f,f=x,x=A,A=f),h>y&&(f=s,s=g,g=f,f=h,h=y,y=f),p>y&&(f=d,d=g,g=f,f=p,p=y,y=f),h>x&&(f=s,s=m,m=f,f=h,h=x,x=f),y>x&&(f=g,g=m,m=f,f=y,y=x,x=f),p>A&&(f=d,d=b,b=f,f=p,p=A,A=f),p>y&&(f=d,d=g,g=f,f=p,p=y,y=f),x>A&&(f=m,m=b,b=f,f=x,x=A,A=f);var k=d,O=p,w=m,E=x;t[i]=s,t[l]=t[e],t[c]=g,t[v]=t[u-1],t[a]=b;var M=e+1,U=u-2,z=E>=O&&O>=E;if(z)for(var N=M;U>=N;++N){var C=t[N],S=r(C);if(O>S)N!==M&&(t[N]=t[M],t[M]=C),++M;else if(S>O)for(;;){var q=r(t[U]);{if(!(q>O)){if(O>q){t[N]=t[M],t[M++]=t[U],t[U--]=C;break}t[N]=t[U],t[U--]=C;break}U--}}}else for(var N=M;U>=N;N++){var C=t[N],S=r(C);if(O>S)N!==M&&(t[N]=t[M],t[M]=C),++M;else if(S>E)for(;;){var q=r(t[U]);{if(!(q>E)){O>q?(t[N]=t[M],t[M++]=t[U],t[U--]=C):(t[N]=t[U],t[U--]=C);break}if(U--,N>U)break}}}if(t[e]=t[M-1],t[M-1]=k,t[u-1]=t[U+1],t[U+1]=w,n(t,e,M-1),n(t,U+2,u),z)return t;if(i>M&&U>a){for(var F,q;(F=r(t[M]))<=O&&F>=O;)++M;for(;(q=r(t[U]))<=E&&q>=E;)--U;for(var N=M;U>=N;N++){var C=t[N],S=r(C);if(O>=S&&S>=O)N!==M&&(t[N]=t[M],t[M]=C),M++;else if(E>=S&&S>=E)for(;;){var q=r(t[U]);{if(!(E>=q&&q>=E)){O>q?(t[N]=t[M],t[M++]=t[U],t[U--]=C):(t[N]=t[U],t[U--]=C);break}if(U--,N>U)break}}}}return n(t,M,U+1)}var e=o(r);return n}function a(r){for(var n=Array(r),t=-1;++t<r;)n[t]=0;return n}function c(r,n){for(var t=r.length;n>t;)r[t++]=0;return r}function l(r,n){if(n>32)throw Error("invalid array width!");return r}function v(r,n){return function(t){var e=t.length;return[r.left(t,n,0,e),r.right(t,n,0,e)]}}function s(r,n){var t=n[0],e=n[1];return function(n){var u=n.length;return[r.left(n,t,0,u),r.left(n,e,0,u)]}}function h(r){return[0,r.length]}function d(){return null}function p(){return 0}function g(r){return r+1}function y(r){return r-1}function m(r){return function(n,t){return n+ +r(t)}}function x(r){return function(n,t){return n-r(t)}}function b(){function r(r){var n=E,t=r.length;return t&&(b=b.concat(r),z=F(z,E+=t),S.forEach(function(e){e(r,n,t)})),l}function e(){for(var r=A(E,E),n=[],t=0,e=0;E>t;++t)z[t]?r[t]=e++:n.push(t);N.forEach(function(r){r(0,[],n)}),q.forEach(function(n){n(r)});for(var u,t=0,e=0;E>t;++t)(u=z[t])&&(t!==e&&(z[e]=u,b[e]=b[t]),++e);for(b.length=e;E>e;)z[--E]=0}function o(r){function e(n,e,u){T=n.map(r),V=$(k(u),0,u),T=t(T,V);var f,o=_(T),i=o[0],a=o[1];if(W)for(f=0;u>f;++f)W(T[f],f)||(z[V[f]+e]|=Y);else{for(f=0;i>f;++f)z[V[f]+e]|=Y;for(f=a;u>f;++f)z[V[f]+e]|=Y}if(!e)return P=T,Q=V,tn=i,en=a,void 0;var c=P,l=Q,v=0,s=0;for(P=Array(E),Q=A(E,E),f=0;e>v&&u>s;++f)c[v]<T[s]?(P[f]=c[v],Q[f]=l[v++]):(P[f]=T[s],Q[f]=V[s++]+e);for(;e>v;++v,++f)P[f]=c[v],Q[f]=l[v];for(;u>s;++s,++f)P[f]=T[s],Q[f]=V[s]+e;o=_(P),tn=o[0],en=o[1]}function o(r,n,t){rn.forEach(function(r){r(T,V,n,t)}),T=V=null}function a(r){for(var n,t=0,e=0;E>t;++t)z[n=Q[t]]&&(t!==e&&(P[e]=P[t]),Q[e]=r[n],++e);for(P.length=e;E>e;)Q[e++]=0;var u=_(P);tn=u[0],en=u[1]}function c(r){var n=r[0],t=r[1];if(W)return W=null,G(function(r,e){return e>=n&&t>e}),tn=n,en=t,X;var e,u,f,o=[],i=[];if(tn>n)for(e=n,u=Math.min(tn,t);u>e;++e)z[f=Q[e]]^=Y,o.push(f);else if(n>tn)for(e=tn,u=Math.min(n,en);u>e;++e)z[f=Q[e]]^=Y,i.push(f);if(t>en)for(e=Math.max(n,en),u=t;u>e;++e)z[f=Q[e]]^=Y,o.push(f);else if(en>t)for(e=Math.max(tn,t),u=en;u>e;++e)z[f=Q[e]]^=Y,i.push(f);return tn=n,en=t,N.forEach(function(r){r(Y,o,i)}),X}function l(r){return null==r?B():Array.isArray(r)?j(r):"function"==typeof r?D(r):C(r)}function C(r){return c((_=v(w,r))(P))}function j(r){return c((_=s(w,r))(P))}function B(){return c((_=h)(P))}function D(r){return _=h,G(W=r),tn=0,en=E,X}function G(r){var n,t,e,u=[],f=[];for(n=0;E>n;++n)!(z[t=Q[n]]&Y)^(e=r(P[n],n))&&(e?(z[t]&=Z,u.push(t)):(z[t]|=Y,f.push(t)));N.forEach(function(r){r(Y,u,f)})}function H(r){for(var n,t=[],e=en;--e>=tn&&r>0;)z[n=Q[e]]||(t.push(b[n]),--r);return t}function I(r){for(var n,t=[],e=tn;en>e&&r>0;)z[n=Q[e]]||(t.push(b[n]),--r),e++;return t}function J(r){function t(n,t,e,u){function f(){++T===L&&(m=R(m,K<<=1),B=R(B,K),L=O(K))}var l,v,s,h,p,g,y=j,m=A(T,L),x=H,k=J,w=T,M=0,U=0;for(X&&(x=k=d),j=Array(T),T=0,B=w>1?F(B,E):A(E,L),w&&(s=(v=y[0]).key);u>U&&!((h=r(n[U]))>=h);)++U;for(;u>U;){for(v&&h>=s?(p=v,g=s,m[M]=T,(v=y[++M])&&(s=v.key)):(p={key:h,value:k()},g=h),j[T]=p;!(h>g||(B[l=t[U]+e]=T,z[l]&Z||(p.value=x(p.value,b[l])),++U>=u));)h=r(n[U]);f()}for(;w>M;)j[m[M]=T]=y[M++],f();if(T>M)for(M=0;e>M;++M)B[M]=m[B[M]];l=N.indexOf(V),T>1?(V=o,W=a):(1===T?(V=i,W=c):(V=d,W=d),B=null),N[l]=V}function e(){if(T>1){for(var r=T,n=j,t=A(r,r),e=0,u=0;E>e;++e)z[e]&&(t[B[u]=B[e]]=1,++u);for(j=[],T=0,e=0;r>e;++e)t[e]&&(t[e]=T++,j.push(n[e]));if(T>1)for(var e=0;u>e;++e)B[e]=t[B[e]];else B=null;N[N.indexOf(V)]=T>1?(W=a,V=o):1===T?(W=c,V=i):W=V=d}else if(1===T){for(var e=0;E>e;++e)if(z[e])return;j=[],T=0,N[N.indexOf(V)]=V=W=d}}function o(r,n,t){if(r!==Y&&!X){var e,u,f,o;for(e=0,f=n.length;f>e;++e)z[u=n[e]]&Z||(o=j[B[u]],o.value=H(o.value,b[u]));for(e=0,f=t.length;f>e;++e)(z[u=t[e]]&Z)===r&&(o=j[B[u]],o.value=I(o.value,b[u]))}}function i(r,n,t){if(r!==Y&&!X){var e,u,f,o=j[0];for(e=0,f=n.length;f>e;++e)z[u=n[e]]&Z||(o.value=H(o.value,b[u]));for(e=0,f=t.length;f>e;++e)(z[u=t[e]]&Z)===r&&(o.value=I(o.value,b[u]))}}function a(){var r,n;for(r=0;T>r;++r)j[r].value=J();for(r=0;E>r;++r)z[r]&Z||(n=j[B[r]],n.value=H(n.value,b[r]))}function c(){var r,n=j[0];for(n.value=J(),r=0;E>r;++r)z[r]&Z||(n.value=H(n.value,b[r]))}function l(){return X&&(W(),X=!1),j}function v(r){var n=D(l(),0,j.length,r);return G.sort(n,0,n.length)}function s(r,n,t){return H=r,I=n,J=t,X=!0,S}function h(){return s(g,y,p)}function k(r){return s(m(r),x(r),p)}function w(r){function n(n){return r(n.value)}return D=f(n),G=u(n),S}function M(){return w(n)}function U(){return T}function C(){var r=N.indexOf(V);return r>=0&&N.splice(r,1),r=rn.indexOf(t),r>=0&&rn.splice(r,1),r=q.indexOf(e),r>=0&&q.splice(r,1),S}var S={top:v,all:l,reduce:s,reduceCount:h,reduceSum:k,order:w,orderNatural:M,size:U,dispose:C,remove:C};nn.push(S);var j,B,D,G,H,I,J,K=8,L=O(K),T=0,V=d,W=d,X=!0;return arguments.length<1&&(r=n),N.push(V),rn.push(t),q.push(e),t(P,Q,0,E),h().orderNatural()}function K(){var r=J(d),n=r.all;return delete r.all,delete r.top,delete r.order,delete r.orderNatural,delete r.size,r.value=function(){return n()[0].value},r}function L(){nn.forEach(function(r){r.dispose()});var r=S.indexOf(e);for(r>=0&&S.splice(r,1),r=S.indexOf(o),r>=0&&S.splice(r,1),r=q.indexOf(a),r>=0&&q.splice(r,1),r=0;E>r;++r)z[r]&=Z;return M&=Z,X}var P,Q,T,V,W,X={filter:l,filterExact:C,filterRange:j,filterFunction:D,filterAll:B,top:H,bottom:I,group:J,groupAll:K,dispose:L,remove:L},Y=~M&-~M,Z=~Y,$=i(function(r){return T[r]}),_=h,rn=[],nn=[],tn=0,en=0;return S.unshift(e),S.push(o),q.push(a),M|=Y,(U>=32?!Y:M&(1<<U)-1)&&(z=R(z,U<<=1)),e(b,0,E),o(b,0,E),X}function a(){function r(r,n){var t;if(!h)for(t=n;E>t;++t)z[t]||(a=c(a,b[t]))}function n(r,n,t){var e,u,f;if(!h){for(e=0,f=n.length;f>e;++e)z[u=n[e]]||(a=c(a,b[u]));for(e=0,f=t.length;f>e;++e)z[u=t[e]]===r&&(a=l(a,b[u]))}}function t(){var r;for(a=v(),r=0;E>r;++r)z[r]||(a=c(a,b[r]))}function e(r,n,t){return c=r,l=n,v=t,h=!0,s}function u(){return e(g,y,p)}function f(r){return e(m(r),x(r),p)}function o(){return h&&(t(),h=!1),a}function i(){var t=N.indexOf(n);return t>=0&&N.splice(t),t=S.indexOf(r),t>=0&&S.splice(t),s}var a,c,l,v,s={reduce:e,reduceCount:u,reduceSum:f,value:o,dispose:i,remove:i},h=!0;return N.push(n),S.push(r),r(b,0,E),u()}function c(){return E}var l={add:r,remove:e,dimension:o,groupAll:a,size:c},b=[],E=0,M=0,U=8,z=C(0),N=[],S=[],q=[];return arguments.length?r(arguments[0]):l}function A(r,n){return(257>n?C:65537>n?S:q)(r)}function k(r){for(var n=A(r,r),t=-1;++t<r;)n[t]=t;return n}function O(r){return 8===r?256:16===r?65536:4294967296}b.version="1.3.7",b.permute=t;var w=b.bisect=e(n);w.by=e;var E=b.heap=u(n);E.by=u;var M=b.heapselect=f(n);M.by=f;var U=b.insertionsort=o(n);U.by=o;var z=b.quicksort=i(n);z.by=i;var N=32,C=a,S=a,q=a,F=c,R=l;"undefined"!=typeof Uint8Array&&(C=function(r){return new Uint8Array(r)},S=function(r){return new Uint16Array(r)},q=function(r){return new Uint32Array(r)},F=function(r,n){if(r.length>=n)return r;var t=new r.constructor(n);return t.set(r),t},R=function(r,n){var t;switch(n){case 16:t=S(r.length);break;case 32:t=q(r.length);break;default:throw Error("invalid array width!")}return t.set(r),t}),r.crossfilter=b}("undefined"!=typeof exports&&exports||this);