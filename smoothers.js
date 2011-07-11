Array.max = function( array ){
    return Math.max.apply( Math, array );
};
Array.min = function( array ){
    return Math.min.apply( Math, array );
};

function _pow_weight(u, w){
	if (u >= 0 && u <= 1) {
		return Math.pow(1 - Math.pow(u,w), w)
	} else {
		return 0
	}
}

function _bisquare_weight(u){
	return _pow_weight(u, 2);
}

function _tricube_weight(u){
	return _pow_weight(u, 3);
}

function _neighborhood_width(x0, xis){
	return Array.max(xis.map(function(xi){
		return Math.abs(x0 - xi)
	}))
}

function _manhattan(x1,x2){
	return Math.abs(x1-x2)
}

function _weighted_means(wxy){
	var wsum = d3.sum(wxy.map(function(wxyi){return wxyi.w}));
	
	return {
			xbar:d3.sum(wxy.map(function(wxyi){
				return wxyi.w * wxyi.x
			})) / wsum,
			ybar:d3.sum(wxy.map(function(wxyi){
				return wxyi.w * wxyi.y
			})) / wsum
		}
}

function _weighted_beta(wxy, xbar, ybar){
	var num = d3.sum(wxy.map(function(wxyi){
		return Math.pow(wxyi.w, 2) * (wxyi.x - xbar) * (wxyi.y - ybar)
	}))
	var denom = d3.sum(wxy.map(function(wxyi){
		return Math.pow(wxyi.w, 2) * (Math.pow(wxyi.x - xbar), 2)
	}))
	return num / denom;
}

function _weighted_least_squares(wxy){

	var ybar, xbar, beta_i, x0;

	var _wm = _weighted_means(wxy);

	xbar = _wm.xbar;
	ybar = _wm.ybar;

	var beta = _weighted_beta(wxy, xbar, ybar)

	return {
		beta : beta,
		xbar : xbar,
		ybar : ybar,
		x0   : ybar - beta * xbar

	}
	return num / denom
}

function _calculate_lowess_fit(x, y, alpha, inc, residuals){
	//
	var k = Math.floor(x.length * alpha);
	var sorted_x = x.slice();
	sorted_x.sort(function(a,b){
		if (a < b) {return -1}
		else if (a > b) {return 1}
		return 0
	});
	var x_max = d3.quantile(sorted_x, .98);
	var x_min = d3.quantile(sorted_x, .02);	

	var xy = d3.zip(x, y, residuals).sort();

	var size = Math.abs(x_max - x_min) / inc;

	var smallest = x_min - size;
	var largest = x_max + size;
	var x_proto = d3.range(smallest, largest, size);
	
	var xi_neighbors;
	var x_i, beta_i, x0_i, delta_i, xbar, ybar;

	// for each prototype, find its fit.
	var y_proto = [];

	for (var i = 0; i < x_proto.length; i += 1){

		x_i = x_proto[i]

		// get k closest neighbors.
		xi_neighbors = xy.map(function(xyi){
			return [
				Math.abs(xyi[0] - x_i), 
				xyi[0], 
				xyi[1],
				xyi[2]]
		}).sort().slice(0, k)

		// Get the largest distance in the neighbor set.
		delta_i = d3.max(xi_neighbors)[0]

		// Prepare the weights for mean calculation and WLS.

		xi_neighbors = xi_neighbors.map(function(wxy){
			return {
				w : _tricube_weight(wxy[0] / delta_i) * wxy[3], 
				x : wxy[1], 
				y  :wxy[2]
			}})
		
		// Find the weighted least squares, obviously.
		var _output = _weighted_least_squares(xi_neighbors)

		x0_i = _output.x0;
		beta_i = _output.beta;

		// 
		y_proto.push(x0_i + beta_i * x_i)
	}
	return {x:x_proto, y:y_proto};
}

/* Here are the functions you are looking for. */

function lowess_robust(x, y, alpha, inc){
	// http://www.unc.edu/courses/2007spring/biol/145/001/docs/lectures/Oct27.html

	// calculate the the first pass.
	var _l;
	var r = [];
	for (var i = 0; i < x.length; i += 1) {r.push(1)};
	_l = _calculate_lowess_fit(x,y,alpha, inc, r);
	var x_proto = _.x;
	var y_proto = _.y;

	// Now, take the fit, recalculate the weights, and re-run LOWESS using r*w instead of w.

	for (var i = 0; i < 3; i += 1){

		r = d3.zip(y_proto, y).map(function(yi){
		return Math.abs(yi[1] - yi[0])
		})

		var q = d3.quantile(r.sort(), .5)

		r = r.map(function(ri){
			return _bisquare_weight(ri / (6 * q))
		})

		_l = _calculate_lowess_fit(x,y,alpha,inc, r);
		x_proto = _l.x;
		y_proto = _l.y;
	}

	return {x:x_proto, y:y_proto};

}

function lowess(x, y, alpha, inc){
	var r = [];
	for (var i = 0; i < x.length; i += 1) {r.push(1)}
	var _l = _calculate_lowess_fit(x, y, alpha, inc, r);
	return {x:_l.x, y:_l.y};
}

//
function least_squares(x, y) {
	var xi, yi,
		_x  = 0,
		_y  = 0,
		_xy = 0,
		_xx = 0;

	var n = x.length;

	for (var i = 0; i < x.length; i += 1) {
		xi = x[i];
		yi = y[i];
		_x += xi;
		_y += yi;
		_xx += xi * xi;
		_xy += xi * yi;
	}

	var x0 = (n * _xy - _x * _y) / (n * _xx - _x * _x);
	var beta = _y / n - (x0 * _x)/n;
	return {
		x0:x0, 
		beta:beta, 
		fit:function(x){
			return x0 + x * beta;
	}}
}
