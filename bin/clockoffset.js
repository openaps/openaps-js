#!/usr/bin/env node
var fs = require('fs');
var clock_input = 'clock.json';
var cwd = process.cwd();

var stats = fs.statSync(cwd + '/' + clock_input);
var systemclock = stats.mtime;

var pumpclock_data = require(cwd + '/' + clock_input);

var fmodtime = new Date(stats.mtime);
var timeZone = fmodtime.toString().match(/([-\+][0-9]+)\s/)[1]
var pumpclock_iso = pumpclock_data + timeZone;
var pumpclock = new Date(pumpclock_iso);

var clockoffset = systemclock - pumpclock;
console.log(JSON.stringify(clockoffset));
