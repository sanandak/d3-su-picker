/* return extreme value of array a between st and en,
 * return max if sign =+1 or min if sign = -1
 * returns {val: maxVal, idx: maxIdx}
 */
const getEx = function(a, st, en, sign) {
  if(sign > 0) {
    let pk = a.slice(st, en-st)
      .reduce((max, p, i) => p.v > max.val ? {val:p.v, idx:i} : max, {val:a[0].v, idx:0});
    return {val:pk.val, idx:pk.idx+st};
  } else {
    let trf = a.slice(st, en-st)
      .reduce((min, p, i) => p.v < min.val ? {val:p.v, idx:i} : min, {val:a[0].v, idx:0});
    return {val:trf.val, idx:trf.idx+st};
  }
};
/* return the index of the last zero crossing of array a */
const getZC = function(a) {
  return a.reduce((zc, p, i, a) => i>0 ? (Math.sign(a[i].v) != Math.sign(a[i-1].v) ? i : zc) : 0, 0);
}
var autop = function(trc, cursI) {
  // cursor is on positive peak:
  if(trc.samps[cursI].v > 0.) {
    // get peak
    let pk = getEx(trc.samps, cursI-100, cursI+100, 1);
    // and the zero crossing before the peak and the one before that
    let zc0 = getZC(trc.samps.slice(pk.idx-10, 10));
    let zc1 = getZC(trc.samps.slice(pk.idx-10, zc0-(pk.idx-10)));
    // and the trough between the two zc
    let trf = getEx(trc.samps, zc1, zc0, -1)
    console.log('autop:', pk, cursI, zc0, zc1, trf);
  }
  console.log('in autop', trc.samps[cursI], cursI);
}
