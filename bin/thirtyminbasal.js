#!/usr/bin/env node

var fs = require('fs');
var cwd = process.cwd();

var clock_input = 'clock.json';
var clockfilename = cwd + '/' + clock_input;

var basalprofile_input = 'constant/current_basal_profile.json';
var basalprofile_data = require(cwd + '/' + basalprofile_input);

// experimental - calculation pump/OS clocks offset - comparision clock.json filestamp and it's contents
function calcClocksOffset(cfilename){
var stats = fs.statSync(cfilename);
var systemclock = stats.mtime;

var pumpclock_data = require(cfilename);

var fmodtime = new Date(stats.mtime);
var timeZone = fmodtime.toString().match(/([-\+][0-9]+)\s/)[1]
var pumpclock_iso = pumpclock_data + timeZone;
var pumpclock = new Date(pumpclock_iso);

var clockoffset = systemclock - pumpclock;
return clockoffset;
}


function ThirtyMinBasalFromNow(basalprofile, currentpumptime){
var currentptime = new Date(currentpumptime);
var current_min = currentptime.getHours() * 60 + currentptime.getMinutes();

basalprofile.sort(function(a, b) {return parseFloat(a.minutes) - parseFloat(b.minutes);});

  for (var i = 0; i < basalprofile.length - 1; i++) {
    if ((current_min >= basalprofile[i].minutes) && (current_min < basalprofile[i + 1].minutes)) {

            if (i == basalprofile.length-1){
               //it's for the last basal of a day
               var basalNowRate = basalprofile[i].rate;
               var basalNowLenght = 1440 - basalprofile[i].minutes;
               var basalNextLeght = basalprofile[1].minutes;
               var basalNextRate = basalprofile[0].rate;
               var basalNowMinLeft = 1440 - current_min;
               var basalNexMinLeft = 30 - basalNowMinLeft;
            }
            else {
               var basalNowRate = basalprofile[i].rate;
               var basalNowLenght = basalprofile[i+1].minutes  - basalprofile[i].minutes;
               var basalNextLeght = basalprofile[i+2].minutes - basalprofile[i+1].minutes;
               var basalNextRate = basalprofile[i+1].rate;
               var basalNowMinLeft = basalprofile[i+1].minutes - current_min;
               var basalNexMinLeft = 30 - basalNowMinLeft;
           }
           
           
           if (basalNowMinLeft > 30) {
                basalNowMinLeft = 30;
                basalNexMinLeft = 0;
           }
           
           //debug logs
           console.log('Current basal rate: ' + basalNowRate + ', duration:' + basalNowLenght + ', minutes left: '+ basalNowMinLeft);
           console.log('Next basal rate: ' + basalNextRate + ', duration: ' + basalNextLeght + ', minutes in next basal: ' + basalNexMinLeft);
           calculatedthirtminbasal = (basalNowRate/basalNowLenght)*basalNowMinLeft + basalNextRate/basalNextLeght * basalNexMinLeft;
           return Math.round((Math.round(calculatedthirtminbasal / 0.05) * 0.05)*100)/100; // round up to 0.05
           
           break;
        }
  }
}
var pumpnow = new Date()-calcClocksOffset(clockfilename);

console.log('OS Clock: ' + new Date());
console.log('Pump Clock: ' + new Date(pumpnow));
console.log('Clock offset: ' + calcClocksOffset(clockfilename) );
console.log('30-Min avg basal from now: ' + ThirtyMinBasalFromNow(basalprofile_data, pumpnow));
