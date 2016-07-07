var idata; 
var data;

var targetHue = 0;
var avgLum = 0;
var avgSat = 0;

var dilateRadius = 3;
var erodeRadius = 4;

var numFingers = 3;
var fingerList = [];
var getFingers = false;

var contourMidpoints = [];

//debug
// var f0 = [];

function captureFingers(){
  getFingers = true;
}

function captureTargetHue(){
  var count = 0;
  var avgHue = 0;

  backContext.drawImage(video,0,0,cw,ch);
  idata = backContext.getImageData(Math.round(cw/2 - 20), Math.round(ch/2 - 20), 40, 40);
  data = idata.data;

  for(var i = 0; i < data.length; i+=4) {
    var r = data[i];
    var g = data[i+1];
    var b = data[i+2];
    var hsl = rgbToHsl(r, g, b);
    var h = hsl[0];
    var s = hsl[1];
    var l = hsl[2];

    targetHue += h;
    avgSat += s;
    avgLum += l;
    count++;
  }

  targetHue /= count;
  avgLum /= count;
  avgSat /= count; 

  update();
}

function computeImage() {

  //get data from video stream
  backContext.drawImage(video,0,0,cw,ch);
  idata = backContext.getImageData(0,0,cw,ch);
  data = idata.data;

  //loop through pixels 
  //compare color and intensity data of each pixel at location (x,y) to the average background pixel at location (x,y)
  for(var i = 0; i < data.length; i+=4) {
    var r = data[i];
    var g = data[i+1];
    var b = data[i+2];
    var hsl = rgbToHsl(r, g, b);
    var h = hsl[0];
    var s = hsl[1];
    var l = hsl[2];

    if (Math.abs(h - targetHue) < thresholdSlider.value){
      shortimg.data[i/4] = 1;
    } else {
      shortimg.data[i/4] = 0;
    }
  }

  dilate(dilateRadius);
  erode(erodeRadius);
}
function update(){

  requestAnimationFrame(update);

  if (video.readyState === video.HAVE_ENOUGH_DATA){

    computeImage();

    candidate = tracker.detect(shortimg);
    
    if (candidate !== undefined){
      contours = candidate.contours;
    }

    //establish initial finger positions
    if ((getFingers === true) && (numFingers <= contours.length)) {
      for (var j = 0; j < numFingers; j++){
        var contour = contours[j];
        var midp = midpoint(contour);
        fingerList.push(midp);
      }
      getFingers = false;
    } 

    //if fingers already established, get midpoints of all contours, find closest to fingerpoints before and update
    else if (fingerList.length === numFingers){
      for (var j = 0; j < contours.length; j++){
        var contour = contours[j];
        var midp = midpoint(contour);
        contourMidpoints.push(midp);
      }

      for (var i = 0; i < numFingers; i++){
        var minDistIndex = findClosest(fingerList[i], contourMidpoints);
        fingerList[i] = contourMidpoints[minDistIndex];
        contourMidpoints.splice(minDistIndex,1);
      }
    }

    for (var i = 0; i < data.length; i+=4){
      if (shortimg.data[i/4] === 0) {
        data[i] = 0;
        data[i+1] = 0;
        data[i+2] = 0;
      } else {
        data[i] = 255;
        data[i+1] = 255;
        data[i+2] = 255;
      }
    }

    idata.data = data;
    context.putImageData(idata,0,0);

    var colors = ["red", "yellow", "green", "blue", "purple"];
    if (fingerList.length === numFingers){
      for (var i = 0; i < numFingers; i++){
        context.fillStyle = colors[i];
        context.fillRect(fingerList[i].x - 3, fingerList[i].y - 3, 6, 6);
      }
    }
  }
}

function findClosest(p, pList){
  var minDist = Math.hypot(p.x - pList[0].x, p.y - pList[0].y);
  var minDistIndex = 0;
  for (var i = 0; i < pList.length; i++){
    var dist = Math.hypot(p.x - pList[i].x, p.y - pList[i].y);
    if (dist < minDist){
      minDist = dist;
      minDistIndex = i;
    }
  }
  return minDistIndex;
}

function dilate(k){
  
  manhattan(1);
  
  for (var i=0; i<shortimg.height; i++){
    for (var j=0; j<shortimg.width; j++){
      if (shortimg.data[(i*shortimg.width)+j]<=k) {
        shortimg.data[(i*shortimg.width)+j] = 255;
      } else {
        shortimg.data[(i*shortimg.width)+j] = 0;
      }
    }
  }
}

function erode(k){
  
  manhattan(0);
  
  for (var i=0; i<shortimg.height; i++){
    for (var j=0; j<shortimg.width; j++){
      if (shortimg.data[(i*shortimg.width)+j]<=k) {
        shortimg.data[(i*shortimg.width)+j] = 0;
      } else {
        shortimg.data[(i*shortimg.width)+j] = 255;
      }
    }
  }
}

function manhattan(on){
  shortimg.height = ch;
  shortimg.width = cw;
  // traverse from top left to bottom right
  for (var i=0; i<shortimg.height; i++){
    for (var j=0; j<shortimg.width; j++){
      if (shortimg.data[(i*shortimg.width)+j] === on){
        // first pass and pixel was on, it gets a zero
        shortimg.data[(i*shortimg.width)+j] = 0;
      } else {
        // pixel was off
        // It is at most the sum of the lengths of the array
        // away from a pixel that is on
        shortimg.data[(i*shortimg.width)+j] = shortimg.height + shortimg.width;
        // or one more than the pixel to the north
        if (i>0) shortimg.data[(i*shortimg.width)+j] = Math.min(shortimg.data[(i*shortimg.width)+j], shortimg.data[((i-1)*shortimg.width)+j]+1);
        // or one more than the pixel to the west
        if (j>0) shortimg.data[(i*shortimg.width)+j] = Math.min(shortimg.data[(i*shortimg.width)+j], shortimg.data[(i*shortimg.width)+(j-1)]+1);
      }
    }
  }
  // traverse from bottom right to top left
  for (var i=shortimg.height-1; i>=0; i--){
    for (var j=shortimg.width-1; j>=0; j--){
      // either what we had on the first pass
      // or one more than the pixel to the south
      if (i+1<shortimg.height) shortimg.data[(i*shortimg.width)+j] = Math.min(shortimg.data[(i*shortimg.width)+j], shortimg.data[((i+1)*shortimg.width)+j]+1);
      // or one more than the pixel to the east
      if (j+1<shortimg.height) shortimg.data[(i*shortimg.width)+j] = Math.min(shortimg.data[(i*shortimg.width)+j], shortimg.data[(i*shortimg.width)+(j+1)]+1);
    }
  }
}

function midpoint (contour){
  var midpoint = {x:0, y:0};
  var xmin = contour[0].x;
  var xmax = contour[0].x;
  var ymin = contour[0].y;
  var ymax = contour[0].y;
  var x,y;

  for (var i = 0; i < contour.length; i++){
    var x = contour[i].x;
    var y = contour[i].y;
    if (x > xmax){
      xmax = x;
    }
    if (x < xmin){
      xmin = x;
    }
    if (y > ymax){
      ymax = y;
    }  
    if (y < ymin){
      ymin = y;
    }
  }

  midpoint.x = Math.round((xmax-xmin)/2) + xmin;
  midpoint.y = Math.round((ymax-ymin)/2) + ymin;
  
  return midpoint;
}
