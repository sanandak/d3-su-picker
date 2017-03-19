exports.loadFile = function (file) {
  var readSU = require("segy-js").readSU;
  var dip = readSU(file);
  return dip;
}
