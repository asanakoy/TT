TT.crossfilter = function() {
	
	var FILTER_TYPE_CONTINUOUS		= "continuous",
		FILTER_TYPE_TAGS			= "tags",
		FILTER_TYPE_UNIQUE			= "unique";
	
	if(!TT.crossfilter.id) TT.crossfilter.id = 0;

	var	cf,
		charts = [],
		data,
		div ,
		filters = [],
		id = TT.crossfilter.id++,
		initialised = false,
		selectedChart = false,
		me = {};
		
	var p = {
		view: {
			width: 400,
			height: 30
		}
	};
	
	try {
		
		cf = crossfilter();		
		test_cf = cf; // REMOVE THIS, only for testing expose cf to global namespace
		
	} catch(e) {
		
		console.error("Crossfilter is not loaded. Get Crossfilter from http://square.github.io/crossfilter/");
		return false;
		
	}	
	
	// Private functions

	function drawChart(filter) {
		
		var chart;
		
		switch(filter.type) {
		
			case FILTER_TYPE_CONTINUOUS:
				chart = new BarChart()
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

					chart.on("brush", renderAll)
						.on("brushend", renderAll);
					
					break;
					
			case FILTER_TYPE_TAGS:
				chart = new WordCloud()
					.dimension(filter.dimension)
					.group(filter.group)
					.title(filter.title);
					break;
					
			default:
				console.error("Invalid filter " + filter.type);
				break;
		}
		
		charts.push(chart);
		div.call(chart);
			
		return chart;
			
	}
	
	function renderAll() {
	
		for( var i = 0; i < charts.length; i++) {
			charts[i].drawChart();
		}
		
		publishUpdate();
	}
	
	function publishUpdate() {
		
		if(me.hasOwnProperty("publish") && charts.length) {	
			
			// Publish all records, ordered according to selected chart
			publishFrom = selectedChart || charts[0];
			me.publish( publishFrom.dimension().top( Infinity ) );
		}
		
	}

	// Initialiser
	
	me.apply = function() {
		
		div = arguments[0];
		
		for( var i = 0; i < filters.length; i++ ) {
		
			drawChart( filters[i] );
			
		}
		
		initialised = true;
		
	};
	
	// Methods
	
	me.addFilter = function(params) {
	
		/*
		
			params {
				
				dimension: 
					- Dimension to filter as String or function
					
				(optional)
				group:
					- Grouping function for dimension
				title:
					- Title. If none given, dimension string will be used
			
			}
		
		*/
		
		var filter = {};
	
		filter.title = params.title || params.dimension.toString();
		
		var filterFunction;
		
		if (typeof params.dimension === "function") {

			filterFunction = params.dimension;

		} else {
		
			filterFunction = function(d) {
				return d[params.dimension];
			};
			
		}
	
		filter.dimension = cf.dimension(filterFunction);

		// Group filter (if no function provided, identity function is used)	
		if( params.group ) {
			
			filter.group = filter.dimension.group(params.group);
			
		} else {
			
			filter.group = filter.dimension.group( function(d) {return d;} );
			
		}
		
		filter.min = d3.min( data, filterFunction );
		filter.max = d3.max( data, filterFunction );
		
		filter.isDate = (filter.min instanceof Date);
		
		// determine filter type based on data
		var allNumeric = true;
		var groupValues = filter.group.all();
		
		for( var i = 0; i < groupValues.length; i++ ) {
		
			if( isNaN( +groupValues[i].key.valueOf() ) ) {
			
				allNumeric = false;
				break;
				
			}	
		}
		
		if ( allNumeric ) {
			
			filter.type = FILTER_TYPE_CONTINUOUS;
			
		}
		
		else if ( filter.group.all().length == filter.dimension.top(Infinity).length ) {

			filter.type = FILTER_TYPE_UNIQUE;

		} else {
			
			filter.type = FILTER_TYPE_TAGS;
			
		}
		
		filters.push(filter);
		
		if (initialised) {
		
			drawChart(filter);
		
		}
		
		return me;
	};
	
	me.forcePublish = function() {
		
		publishUpdate();
		
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
		
		for(var i = 0; i < charts.length; i++) {
			
			charts[i].redrawChart();
			
		}
		
		publishUpdate();
		
		return me;
	};
	
	me.filters = function() {
		
		return filters;
		
	};
	
	return me;
	
	// -- BarChart
	function BarChart() {
		
		var div,
			me = {},
			x,
			y = d3.scale.linear().range([p.view.height, 0]),
			id = charts.length, // CHANGE THIS dangerous to use index as unique identifier
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
			
			div.select(".title a.reset")
				.style("display", "block");
			
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
					
					div.select(".title a.reset")
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
			
			try {
			
				div = arguments[0];
				
			} catch(e) {
			
				console.error("No DOM element specified");
				
			}
			
			div = div.append("div")
				.attr("id", "barChart_" + id)
				.attr("class", "chart barchart");
				
			initBrush();
			me.drawChart();
			
		};
	
		// Methods
		me.drawChart = function(redraw) {
		
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
				var div_title = div.append("div")
					.attr("class", "title")
					.text(title);
					
				// Add reset link
				div_title.append("a")
					.attr("class", "reset")
					.text("Reset")
					.on("click", me.reset );
					
				// Add sort by link
				div_title.append("a")
					.attr("class", "sort")
					.text("Sort by")
					.style("display", id === 0 ? "none" : "")
					.on("click", function() { me.sortBy( id ); } );
					
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
			if( g.empty() || redraw) {
				
				drawChartSkeleton();
				
			}
			
			if(brushDirty) {
			
				brushDirty = false;
				g.selectAll(".brush")
					.call(brush);
				
				// Display reset button if brush is usde
				div.select(".title a.reset")
					.style("display", brush.empty() ? "" : "block");
				
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
		
		me.reset = function() {
			
			charts[id].filter(null);
			renderAll();
			
		};
		
		me.redrawChart = function() {
			
			div.select("svg").remove();
			div.select(".title").remove();
			me.drawChart(true);
			
		};
		
		me.sortBy = function(id) {
			
			d3.selectAll(".title .sort")
				.style("display", "block");
				
			d3.select("#barChart_" + id + " .sort")
				.style("display", "none");
			
			selectedChart = charts[id];
			publishUpdate();
			
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
	
	// -- WordCloud
	function WordCloud() {
	
		if ( !WordCloud.id ) WordCloud.id = 0;

		var activeTerms = [],
			dimension,
			div,
			group,
			me = {},
			id = charts.length, // CHANGE THIS dangerous to use index as unique identifier
			title;
		
		// Initialiser
		
		me.apply = function() {
			
			try {
			
				div = arguments[0];
				
			} catch(e) {
			
				console.error("No DOM element specified");
				return false;
			}
			
			div = div.append("div")
				.attr("id", "wordCloud_" + id)
				.attr("class", "chart wordCloud");
				
			me.drawChart();
			
		};
		
		// Methods
		
		me.drawChart = function( redraw ) {
		
			function drawChartSkeleton() {
				
				// Add title
				var div_title = div.append("div")
					.attr("class", "title")
					.text(title);
				
				// Add reset link
				div_title.append("a")
					.attr("class", "reset")
					.text("Reset")
					.on("click", me.reset );
					
				// Add sort by link
				div_title.append("a")
					.attr("class", "sort")
					.text("Sort by")
					.style("display", id === 0 ? "none" : "")
					.on("click", function() { me.sortBy( id ); } );
					
				// Append element for wordCloud
				g = div.append("div")
					.attr("width", width)
					.attr("class", "wordcloud_container");
				
			}
			
			function filterFunction(d) {
				
				return activeTerms.indexOf( d ) !== -1;
				
			}
			
			var width = p.view.width;
			
			var g = div.select("div.wordcloud_container");
			
			if ( g.empty() || redraw ) {
				
				drawChartSkeleton();
				
			}
			
			
			var words_update = g.selectAll("span")
				.data( group.all()
					.filter( function(d) { 
					if( d.value > 0) {
						return d;
					}
				}), function(d) { return d.key; } )
					.sort( function (a,b) {
						return b.key < a.key;	
					}),
				words_enter = words_update.enter(),
				words_exit = words_update.exit(),
				words_scale = d3.scale.linear()
					.domain( [ 0, Math.min( d3.max( group.all(), function(d) { return d.value; }), 10 ) ] ) // Manual maximum of 500 (not very elegant, CHANGE)
					.range( [ 0, 1 ]);
					
				words_attributes = {
					
					fontSize: function(d) {
						
						return Math.min( words_scale( d.value ), 1) * 9 + 8 + "px";
						
					}
					
				};
			
			words_update.style("font-size", words_attributes.fontSize);
			
			words_enter.append("span")
				.text( function(d) { return d.key; } )
				.style("font-size", words_attributes.fontSize)
				.attr("class", function(d) {
					return "term term_" + d.key + " " + ( activeTerms.indexOf( d.key ) !== -1 ? "selected" : "");
				})
				.on( "click", function(d) {
					
					if ( activeTerms.indexOf( d.key ) === -1) {
						
						activeTerms.push( d.key );
						d3.select(this).classed("selected", 1);
						
					} else {
						
						activeTerms.splice( activeTerms.indexOf( d.key) , 1);
						d3.select(this).classed("selected", 0);

					}
					
					if( activeTerms.length ) {
					
						dimension.filterFunction( filterFunction );
						d3.select( this.parentNode ).classed("filtered", 1);
						div.select(".title a.reset")
							.style("display", "block");			
						
					} else {	
					
						me.reset();
						
					}
					
					
					renderAll();
					
				});
				
			words_exit.remove();
			
		};
		
		me.redrawChart = function() {
			
			div.select("div.wordcloud_container").remove();
			div.select(".title").remove();
			me.drawChart(true);
			
		};
		
		me.reset = function() {
			
			activeTerms = [];
			dimension.filterAll();
			
			div.selectAll(".term")
				.style("color", "");
			
			div.select(".filtered")
				.classed("filtered" , 0);
				
			div.selectAll(".selected")
				.classed("selected" , 0);
				
			div.select(".title a.reset")
			.style("display", null);
							
			renderAll();
			
		};	
		
		me.sortBy = function(id) {
			
			console.log("Hello" + id);
			
			d3.selectAll(".title .sort")
				.style("display", "block");
				
			d3.select("#wordCloud_" + id + " .sort")
				.style("display", "none");
			
			selectedChart = charts[id];
			publishUpdate();
			
		};
		
		// Accessors
		
		me.dimension = function(_) {
			if (!arguments.length) return dimension;
			dimension = _;
			return me;
		};
		
		me.group = function(_) {
			if (!arguments.length) return group;
			group = _;
			return me;
		};
	
		me.title = function(_) {
			if (!arguments.length) return title;
			title = _;
			return me;
		};
	
		return me;
		
	}
	
};

String.prototype.ucfirst = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
