var getCurvePoints = require('cardinal-spline-js').getCurvePoints;

/* return extreme value of array a between lims[0] and lims[1],
 * return max if sign =+1 or min if sign = -1
 * returns index of extremum, idx
 */
const getEx = function(a, lims, sign) {
  let compr;
  if(sign > 0) {
    compr = function(a,b){return b-a;}; // return largest
  } else {
    compr = function(a,b){return a-b;}; // return smallest
  }
  // search for index of largest or smallest
  let pkI = d3.scan(a.slice(lims[0], lims[1]), compr) + lims[0];
//      .reduce((max, p, i) => p > max.val ? {val:p, idx:i} : max, {val:a[0], idx:0});
  return pkI;
};
/* return the indices of all zero crossing of array a */
const getZC = function(a, st, en) {
  const zc=[];
  for(let i=st+1; i<=en; i++) {
    if(Math.sign(a[i]) != Math.sign(a[i-1])) zc.push(i);
  }
  if(zc.length == 0) zc=[st, en]; // if no zero crossing were found.
  if(zc.length == 1) zc.unshift(st); // insert start if only one zc found (??)
  return zc;
  //idx = b.reduce((zc, p, i, a) => i>0 ? (Math.sign(a[i]) != Math.sign(a[i-1]) ? zc.push(i) : zc) : 0, 0);
}

/* autopick peak and troughs around the current cursor location
 * trc - the current trace
 * cursI - index of cursor value
 * dt - dt
 * return - {picks:..., picks10:...}, where
 *    picks: {peakVal:..., peakTime:..., trough0Val:, trough0Time, trough1Val:, trough1Time:}
 *    picks10: same fields as picks, but the times/values are from the x10 spline interpolation
 */
var autop = function(trc, cursI, dt) {
  let a0 = trc.samps.map(x=>[x.t,x.v]); // convert to 2d array [[x1,y1], [x2,y2], ...]
  // and convert to flattened [x1,y1,x2,y2,...]
  let arr = [].concat(...a0); // ... is the "spread" operator
  let v0 = arr.filter((v,i) => i%2==1);
  let t0 = arr.filter((v,i) => i%2==0);

  let a10 = getCurvePoints(arr, 0.5, 10); // interpolate by x10

  // interpolated value and time arrays
  let v10 = a10.filter((v,i) => i%2==1); // get ys
  let t10 = a10.filter((t,i) => i%2==0); // get ts

  //let interp = d3.interpolateBasis(vArr);
  //let v10 = d3.quantize(interp, vArr.length * 10); // x10 interp
  let cursI10 = cursI * 10;

  let sign = 1;
  if(trc.samps[cursI].v < 0.) { // i'm in a trough
    sign = -1;
    v10.forEach((x,i,a) => a[i]=-x); // negate value arrays
    v0.forEach((x,i,a) => a[i]=-x);
  }

  // get peak/troughs of the interpolated array
  let zcpre = getZC(v10, cursI10-100, cursI10); // all zc prior to me
  let zcpost = getZC(v10, cursI10, cursI10+100); // and after me
  // the two zero crossing before me bound the prev trough
  let trfpre = getEx(v10, zcpre.slice(-2), -1);
  // and the zero crossings after me are the next trough
  let trfpost = getEx(v10, zcpost.slice(0,2), -1);
  // peak value between the last zero crossing prior to me and the first one after.
  let pk = getEx(v10, [zcpre[zcpre.length-1], zcpost[0]], 1)
  let picks10 = {
    peakVal: sign*v10[pk], peakTime: t10[pk],
    trough0Val: sign*v10[trfpre], trough0Time: t10[trfpre],
    trough1Val: sign*v10[trfpost], trough1Time: t10[trfpost]
  }

  // get peak/troughs of the interpolated array
  zcpre = getZC(v0, cursI-10, cursI); // all zc prior to me
  zcpost = getZC(v0, cursI, cursI+10); // and after me
  // the two zero crossing before me bound the prev trough
  trfpre = getEx(v0, zcpre.slice(-2), -1);
  // and the zero crossings after me are the next trough
  trfpost = getEx(v0, zcpost.slice(0,2), -1);
  // peak value between the last zero crossing prior to me and the first one after.
  pk = getEx(v0, [zcpre[zcpre.length-1], zcpost[0]], 1)
  let picks = {
    peakVal: sign*v0[pk], peakTime: t0[pk],
    trough0Val: sign*v0[trfpre], trough0Time: t0[trfpre],
    trough1Val: sign*v0[trfpost], trough1Time: t0[trfpost]
  }
  //console.log(picks);
  //console.log(picks10); //pk, trfpre, trfpost, zcpre, zcpost);
  //let ppInt = {peakVal: pk.val, peakTime: t10[pk.idx],  troughVal: trf.val, troughTime: t10[trf.idx]};
  //console.log(ppInt);

  console.log('in autop', trc.samps[cursI], cursI);
  return({picks:picks, picks10:picks10});
}
