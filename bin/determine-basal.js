#!/usr/bin/env node

function getLastGlucose(data) {
    
    var now = data[0];
    var last = data[1];
    var avg;
    //TODO: calculate average using system_time instead of assuming 1 data point every 5m
    if (typeof data[3] !== 'undefined' && data[3].glucose > 30) {
        avg = ( now.glucose - data[3].glucose) / 3;
    } else if (typeof data[2] !== 'undefined' && data[2].glucose > 30) {
        avg = ( now.glucose - data[2].glucose) / 3;
    } else if (typeof data[1] !== 'undefined' && data[1].glucose > 30) {
        avg = now.glucose - data[1].glucose;
    } else { avg = 0; }
    var o = {
        delta: now.glucose - last.glucose
        , glucose: now.glucose
        , avgdelta: avg
    };
    
    return o;
    
}

function setTempBasal(rate, duration) {
    
    maxSafeBasal = Math.min(profile_data.max_basal, 2 * profile_data.max_daily_basal, 4 * profile_data.current_basal);
    
    if (rate < 0) { rate = 0; } // if >30m @ 0 required, zero temp will be extended to 30m instead
    else if (rate > maxSafeBasal) { rate = maxSafeBasal; }
    
    requestedTemp.duration = duration;
    requestedTemp.rate = Math.round( rate * 1000 ) / 1000;
    
};


if (!module.parent) {
    var iob_input = process.argv.slice(2, 3).pop()
    var temps_input = process.argv.slice(3, 4).pop()
    var glucose_input = process.argv.slice(4, 5).pop()
    var profile_input = process.argv.slice(5, 6).pop()
    
    if (!iob_input || !temps_input || !glucose_input || !profile_input) {
        console.error('usage: ', process.argv.slice(0, 2), '<iob.json> <current-temps.json> <glucose.json> <profile.json>');
        process.exit(1);
    }
    
    var cwd = process.cwd()
    var glucose_data = require(cwd + '/' + glucose_input);
    var temps_data = require(cwd + '/' + temps_input);
    var iob_data = require(cwd + '/' + iob_input);
    var profile_data = require(cwd + '/' + profile_input);
    
    if (typeof profile_data === 'undefined' || typeof profile_data.current_basal === 'undefined') {
        console.error('Error: could not get current basal rate');
        process.exit(1);
    }
    
    // if target_bg is set, great. otherwise, if min and max are set, then set target to their average
    var target_bg;
    if (typeof profile_data.target_bg !== 'undefined') {
        target_bg = profile_data.target_bg;
    } else {
        if (typeof profile_data.max_bg !== 'undefined' && typeof profile_data.max_bg !== 'undefined') {
            target_bg = (profile_data.min_bg + profile_data.max_bg) / 2;
        } else {
            console.error('Error: could not determine target_bg');
            process.exit(1);
        }
    }
    
    var glucose_status = getLastGlucose(glucose_data);
    var bg = glucose_status.glucose;
    var tick;
    if (glucose_status.delta >= 0) { tick = "+" + glucose_status.delta; }
    else { tick = glucose_status.delta; }
    console.error("IOB: " + iob_data.iob.toFixed(2) + ", Bolus IOB: " + iob_data.bolusiob.toFixed(2));
    var bgi = -iob_data.activity * profile_data.sens * 5;
    console.error("Avg. Delta: " + glucose_status.avgdelta.toFixed(1) + ", BGI: " + bgi.toFixed(1));
    // project deviation over next 15 minutes
    var deviation = Math.round( 15 / 5 * ( glucose_status.avgdelta - bgi ) );
    console.error("15m deviation: " + deviation.toFixed(0));
    var bolusContrib = iob_data.bolusiob * profile_data.sens;
    var naive_eventualBG = Math.round( bg - (iob_data.iob * profile_data.sens) );
    var eventualBG = naive_eventualBG + deviation;
    var naive_snoozeBG = Math.round( naive_eventualBG + bolusContrib );
    var snoozeBG = naive_snoozeBG + deviation;
    console.error("BG: " + bg + tick + " -> " + eventualBG + "-" + snoozeBG + " (Unadjusted: " + naive_eventualBG + "-" + naive_snoozeBG + ")");
    if (typeof eventualBG === 'undefined') { console.error('Error: could not calculate eventualBG'); }
    var requestedTemp = {
        'temp': 'absolute'
    };
    
    
    
    //if old reading from Dexcom do nothing
    
    var systemTime = new Date();
    var displayTime = new Date(glucose_data[0].display_time.replace('T', ' '));
    var minAgo = (systemTime - displayTime) / 60 / 1000
    var threshold = profile_data.min_bg - 30;
    
    if (minAgo < 10 && minAgo > -5) { // Dexcom data is recent, but not far in the future
        
        if (bg > 10) {  //Dexcom is in ??? mode or calibrating, do nothing. Asked @benwest for raw data in iter_glucose
            
            if (bg < threshold) { // low glucose suspend mode: BG is < ~80
		console.error("BG " + bg + "<" + threshold);
                if (glucose_status.delta > 0) { // if BG is rising
                    if (temps_data.rate > profile_data.current_basal) { // if a high-temp is running
                        setTempBasal(0, 0); // cancel high temp
                    } else if (temps_data.duration && eventualBG > profile_data.max_bg) { // if low-temped and predicted to go high from negative IOB
                        setTempBasal(0, 0); // cancel low temp
                    } else {
                        console.error("No action required (" + bg + "<" + threshold + ", and no high-temp to cancel)")
                    }
                }
                else { // BG is not yet rising
                    setTempBasal(0, 30);
                }
            
            } else {
                
                // if BG is rising but eventual BG is below target, or BG is falling but eventual BG is above target,
                // then cancel any temp basals.
                if ((glucose_status.delta > 0 && eventualBG < profile_data.min_bg) || (glucose_status.delta < 0 && eventualBG >= profile_data.max_bg)) {
                    if (temps_data.duration > 0) { // if there is currently any temp basal running
                        setTempBasal(0, 0); // cancel temp
                    } else {
                        console.error("No action required (" + tick + " and no temp to cancel)")
                    }
        
                } else if (eventualBG < profile_data.min_bg) { // if eventual BG is below target:
                    // if this is just due to boluses, we can snooze until the bolus IOB decays (at double speed)
                    if (snoozeBG > profile_data.min_bg) { // if adding back in the bolus contribution BG would be above min
                        console.error("No action required (snoozing for boluses: eventual BG range " + eventualBG + "-" + snoozeBG + ")")
                    } else {
                        // calculate 30m low-temp required to get projected BG up to target
                        // negative insulin required to get up to min:
                        //var insulinReq = Math.max(0, (target_bg - eventualBG) / profile_data.sens);
                        // use snoozeBG instead of eventualBG to more gradually ramp in any counteraction of the user's boluses
                        var insulinReq = Math.max(0, (target_bg - snoozeBG) / profile_data.sens);
                        // rate required to deliver insulinReq less insulin over 30m:
                        var rate = profile_data.current_basal - (2 * insulinReq);
                        
                        if (typeof temps_data.rate !== 'undefined' && (temps_data.duration > 0 && rate > temps_data.rate - 0.1)) { // if required temp < existing temp basal
                            console.error("No action required (existing basal " + temps_data.rate + " <~ required temp " + rate + " )")
                        } else {
                            console.error("Eventual BG " + eventualBG + "<" + profile_data.min_bg);
                            setTempBasal(rate, 30);
                        }
                    }

                } else if (eventualBG > profile_data.max_bg) { // if eventual BG is above target:
                    // calculate 30m high-temp required to get projected BG down to target
                    // additional insulin required to get down to max:
                    var insulinReq = (target_bg - eventualBG) / profile_data.sens;
                    // rate required to deliver insulinReq more insulin over 30m:
                    var rate = profile_data.current_basal - (2 * insulinReq);
                    if (typeof temps_data.rate !== 'undefined' && (temps_data.duration > 0 && rate < temps_data.rate + 0.1)) { // if required temp > existing temp basal
                        console.error("No action required (existing basal " + temps_data.rate + " >~ required temp " + rate + " )")
                    } else {
                        setTempBasal(rate, 30);
                    }
        
                } else { 
                    console.error(eventualBG + " is in range. No action required.")
                }
            }
        }  else {
            console.error("CGM is calibrating or in ??? state")
        }
    } else {
        console.error("BG data is too old")
    }
    
console.log(JSON.stringify(requestedTemp));
}



