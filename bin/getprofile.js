#!/usr/bin/env node

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
    var basalRate = basalprofile_data[basalprofile_data.length-1].rate
    
    for (var i = 0; i < basalprofile_data.length - 1; i++) {
        if ((now >= getTime(basalprofile_data[i].minutes)) && (now < getTime(basalprofile_data[i + 1].minutes))) {
            basalRate = basalprofile_data[i].rate;
            break;
        }
    }
    profile.current_basal= basalRate;
}

function bgTargetsLookup(){
    var now = new Date();
    
    //bgtargets_data.targets.sort(function (a, b) { return a.offset > b.offset });
    var bgTargets = bgtargets_data.targets[bgtargets_data.targets.length - 1]
    
    for (var i = 0; i < bgtargets_data.targets.length - 1; i++) {
        if ((now >= getTime(bgtargets_data.targets[i].offset)) && (now < getTime(bgtargets_data.targets[i + 1].offset))) {
            bgTargets = bgtargets_data.targets[i];
            break;
        }
    }
    profile.max_bg = bgTargets.high;
    profile.min_bg = bgTargets.low;
}

function carbRatioLookup() {
    var now = new Date();
    //carbratio_data.schedule.sort(function (a, b) { return a.offset > b.offset });
    var carbRatio = carbratio_data.schedule[carbratio_data.schedule.length - 1]
    
    for (var i = 0; i < carbratio_data.schedule.length - 1; i++) {
        if ((now >= getTime(carbratio_data.schedule[i].offset)) && (now < getTime(carbratio_data.schedule[i + 1].offset))) {
            carbRatio = carbratio_data.schedule[i];
            break;
        }
    }
    profile.carbratio = carbRatio.ratio;    
}

function isfLookup() {
    var now = new Date();
    //isf_data.sensitivities.sort(function (a, b) { return a.offset > b.offset });
    var isfSchedule = isf_data.sensitivities[isf_data.sensitivities.length - 1]
    
    for (var i = 0; i < isf_data.sensitivities.length - 1; i++) {
        if ((now >= getTime(isf_data.sensitivities[i].offset)) && (now < getTime(isf_data.sensitivities[i + 1].offset))) {
            isfSchedule = isf_data.sensitivities[i];
            break;
        }
    }
    profile.sens = isfSchedule.sensitivity;
}

function maxDailyBasal(){
    basalprofile_data.sort(function (a, b) { return a.rate < b.rate });
    profile.max_daily_basal = basalprofile_data[0].rate;
}

/*Return maximum daily basal rate(U / hr) from profile.basals */

function maxBasalLookup() {
    
    profile.max_basal =pumpsettings_data.maxBasal;
}

/* Return average 30-min basal (from now)*/

function ThirtyMinBasalFromNow(basalprofile, currentpumptime){
var currentptime = new Date(currentpumptime);
var current_min = currentptime.getHours() * 60 + currentptime.getMinutes();
basalprofile.sort(function(a, b) {return parseFloat(a.minutes) - parseFloat(b.minutes);});

  for (var i = 0; i < basalprofile.length;i++) {
     
     var cBasalId = i;    // current basal id
     if (cBasalId == (basalprofile.length)){ cBasalId = 0}

     var nBasalId = cBasalId+1;  // nex basal id
     if (nBasalId == (basalprofile.length)){ nBasalId = 0}

     var nnBasalId = nBasalId+1; // basal id after the nBasalId 
     if (nnBasalId == (basalprofile.length)){ nnBasalId = 0}
     
     var cBasalMinS = basalprofile[cBasalId].minutes;
     var cBasalMinE = basalprofile[nBasalId].minutes;
     if (cBasalMinE == 0){ cBasalMinE = 1440}

     var nBasalMinS = basalprofile[nBasalId].minutes;
     var nBasalMinE = basalprofile[nnBasalId].minutes;
     if (nBasalMinE == 0){ nBasalMinE = 1440}

     if ((current_min >= cBasalMinS) && (current_min < cBasalMinE)) {
       
        var cBasalRate = basalprofile[cBasalId].rate;
        var cBasalLen = cBasalMinE - cBasalMinS;

        var nBasalRate = basalprofile[nBasalId].rate;
        var nBasalLen = nBasalMinE - nBasalMinS;
      
        var cBasalMinLeft = cBasalMinE - current_min;
        var nBasalMinLeft = 30 - cBasalMinLeft;

	    //shotren up to 30 min
        if (cBasalMinLeft > 30) {
           cBasalMinLeft = 30;
           nBasalMinLeft = 0;
        }

        //debug logs
        //console.error('Current basal rate: ' + cBasalRate + '; Duration:' + cBasalLen + '; Minutes left: '+ cBasalMinLeft);
        //console.error('Next basal rate: ' + nBasalRate + '; Duration: ' + nBasalLen + '; Minutes in next basal: ' + nBasalMinLeft);
        var avgBasal = 2 * ((cBasalRate/cBasalLen)*cBasalMinLeft + nBasalRate/nBasalLen * nBasalMinLeft); 
        profile.thirtymin_basal=Math.round((Math.round(avgBasal / 0.05) * 0.05)*100)/100; // round up to 0.05
        break;

     }
  }

}


if (!module.parent) {
    
    var pumpsettings_input = process.argv.slice(2, 3).pop()
    var bgtargets_input = process.argv.slice(3, 4).pop()
    var isf_input = process.argv.slice(4, 5).pop()
    var basalprofile_input = process.argv.slice(5, 6).pop()
    var carbratio_input = process.argv.slice(6, 7).pop()
    
    if (!pumpsettings_input || !bgtargets_input || !isf_input || !basalprofile_input || !carbratio_input) {
        console.log('usage: ', process.argv.slice(0, 2), '<pump_settings.json> <bg_targets.json> <isf.json> <current_basal_profile.json> <carb_ratio.json>');
        process.exit(1);
    }
    
    var cwd = process.cwd()
    var pumpsettings_data = require(cwd + '/' + pumpsettings_input);
    var bgtargets_data = require(cwd + '/' + bgtargets_input);
    var isf_data = require(cwd + '/' + isf_input);
    var basalprofile_data = require(cwd + '/' + basalprofile_input);
    var carbratio_data = require(cwd + '/' + carbratio_input);;

    var profile = {        
          carbs_hr: 28 // TODO: verify this is completely unused and consider removing it if so
        , max_iob: 1 // maximum amount of non-bolus IOB OpenAPS will ever deliver
        , dia: pumpsettings_data.insulin_action_curve        
        , type: "current"
    };

    basalLookup();
    maxDailyBasal();
    maxBasalLookup()
    bgTargetsLookup();
    carbRatioLookup();
    isfLookup();
    ThirtyMinBasalFromNow(basalprofile_data, new Date());

    console.log(JSON.stringify(profile));
}
