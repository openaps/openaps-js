#!/usr/bin/env node

/* my-pebble - borrowing form openaps-js/pebble.js */

function getTime(minutes) {
    var baseTime = new Date();
    baseTime.setHours('00');
    baseTime.setMinutes('00');
    baseTime.setSeconds('00');

    return baseTime.getTime() + minutes * 60 * 1000;

}

/* Return basal rate(U / hr) at the provided timeOfDay */

function basalLookup() {
    var now = new Date();
    basalRate = Math.round(basalprofile_data[basalprofile_data.length-1].rate*100)/100
    
    for (var i = 0; i < basalprofile_data.length - 1; i++) {
        if ((now >= getTime(basalprofile_data[i].minutes)) && (now < getTime(basalprofile_data[i + 1].minutes))) {
            basalRate = basalprofile_data[i].rate.toFixed(2);
            break;
        }
    }
}


function fileHM(file) {
    var filedate = new Date(fs.statSync(file).mtime);
    var HMS = filedate.toLocaleTimeString().split(":")
    return HMS[0].concat(":", HMS[1]);
}
if (!module.parent) {

    var fs = require('fs');
    var glucose_input = process.argv.slice(2, 3).pop()
    var iob_input = process.argv.slice(3, 4).pop()
    var basalprofile_input = process.argv.slice(4, 5).pop()
    var currenttemp_input = process.argv.slice(5, 6).pop()
    var requestedtemp_input = process.argv.slice(6, 7).pop()
    var enactedtemp_input = process.argv.slice(7, 8).pop()
    var clock_input = process.argv.slice(8).pop()

    if (!glucose_input || !iob_input || !basalprofile_input || !currenttemp_input || !requestedtemp_input || !enactedtemp_input || !clock_input) {
    	console.log('usage: ', process.argv.slice(0, 2), '<glucose.json> <iob.json> <current_basal_profile.json> <currenttemp.json> <requestedtemp.json> <enactedtemp.json> <clock.json>'); 
    	 process.exit(1);
    }

    var cwd = process.cwd()
    var file = cwd + '/' + glucose_input;
    var glucose_data = require(file);
    var bgTime = fileHM(file);
    if (glucose_data[0].dateString) {
        var bgDate = new Date(glucose_data[0].dateString);
        var HMS = bgDate.toLocaleTimeString().split(":")
         bgTime = HMS[0].concat(":", HMS[1]);
    }

    var bgnow = glucose_data[0].glucose;
    var iob_data = require(cwd + '/' + iob_input);
    iob = iob_data.iob.toFixed(1);
    var basalprofile_data = require(cwd + '/' + basalprofile_input);
    var basalRate;
    basalLookup();
    file = cwd + '/' + currenttemp_input;
    var temp = require(file);
    var temp_time = fileHM(file);
    var tempstring;
    if (temp.duration > 1) {
        basalRate = temp.rate.toFixed(1);
    }
    var requestedtemp = require(cwd + '/' + requestedtemp_input);
    var enactedtemp = require(cwd + '/' + enactedtemp_input);
    if (enactedtemp.duration > 1) {
        basalRate = enactedtemp.rate.toFixed(1);
         }
    tz = new Date().toString().match(/([-\+][0-9]+)\s/)[1];
    var clock = require(cwd + '/' + clock_input);
    enactedDate = new Date(clock.concat(tz));
    enactedHMS = enactedDate.toLocaleTimeString().split(":");
    enactedat = enactedHMS[0].concat(":", enactedHMS[1]);

    var arrow = glucose_data[0].trend_arrow;
    var delta = glucose_data[0].glucose - glucose_data[1].glucose;
    var pebble = {
        "bg": bgnow,
        "arrow": arrow,
        "delta": delta,
        "enactedAt": enactedat,
        "rate": basalRate,
        "iob": iob,
        "eventBg": requestedtemp.eventualBG,
        "refresh_frequency": 1
    };
    console.log(JSON.stringify(pebble));
    }
    
