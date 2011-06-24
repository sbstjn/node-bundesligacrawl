var sys = require("sys");
var st = process.openStdin();

var DEF_CURRENT_SEASON  = 2011;
var DEF_CURRENT_PATH    = 'http://dfl.de/de/inc/spieltage/liga/{SPIELTAG}.html?123';
var DEF_ARCHIVE_PATH    = 'http://dfl.de/de/liga/saisonrueckblick/{SAISON}/spieltag{SPIELTAG}.php';
var DEF_INPUT_OFFSET    = -1;
var DEF_MODE_CURRENT    = 'current';
var DEF_MODE_ARCHIVE    = 'archive';

var curSeason   = null;
var curMatchday = null;
var curLimit    = null;
var curMode     = null;
var urlStack    = new Array();
var matchday    = new Array();

/** 
 * Get matchdays from Bundesliga 
 * @param int thisSeason season
 * @param int thisMatchday matchday to start from
 * @param int thisLimit last matchday to get
 * @return array of matchdays containing array of matchday objects
 */
function fetchGames(thisSeason, thisMatchday, thisLimit) {
    // User has to enter the year of the last match, url requires year of season start
    thisSeason = thisSeason*1 + DEF_INPUT_OFFSET*1;
    
    // Set variables for different html responses 
    if (thisSeason == DEF_CURRENT_SEASON) {
        baseURL = DEF_CURRENT_PATH;  
        curMode = DEF_MODE_CURRENT;
    } else {
        baseURL = DEF_ARCHIVE_PATH;
        curMode = DEF_MODE_ARCHIVE;
    }

    // create stack of matchdays
    for (var i = thisMatchday; i <= thisLimit; i++) {
        thisURL = baseURL.replace('{SPIELTAG}', i*1);
        thisURL = thisURL.replace('{SAISON}', thisSeason);
        
        urlStack.push({matchday: i*1, url: thisURL});
    }
    
    // start parsing stack
    parseGamesStack();
}

/**
 * Parse next available matchday or call finish method 
 */
function parseNextGames() {
    if (urlStack.length > 0) {
        curObject   = urlStack.shift();
        curMatchday = curObject.matchday;
        
        if (matchday[curMatchday] == null) {
            matchday[curMatchday] = new Array();
        }
        
        getPage(curObject.url, function(body) {
            switch (curMode) {
                case DEF_MODE_ARCHIVE:
                
                    break;
                case DEF_MODE_CURRENT:
                    // Parse current season, this needs some different handling
                    
                    var html    = "<!doctype html><html><body>" + body + "</body></html>";            
                    var window  = require('jsdom').jsdom(html, null, { FetchExternalResources: false, ProcessExternalResources: false, MutationEvents: false, QuerySelector: false }).createWindow();
                    var $       = require('jquery').create(window);
                    var $       = require('jquery').create(window);
            
                    $("tr").each( function(el) {
                        curDatum = $(this).find('.tn01').first().text();
                        if (curDatum != 'Datum' && curDatum != '') {
                            curMatch = {
                                date:       curDatum                             
                              , time:       $(this).find('.tn02').first().text() 
                              , home:       $(this).find('.tn03').first().text() 
                              , guest:      $(this).find('.tn05').first().text() 
                              , result:     $(this).find('.tn06').first().text() 
                            };
                        
                            matchday[curMatchday].push(curMatch);
                        }
                    });
                    
                    break;
            }

            // Start next matchday
            parseNextGames();
        });
    } else {
        finishGames();
    }
}

/** 
 * Finish games
 */
function finishGames() {
    console.log(matchday);
}

/**
 * Start handling matchday stack 
 */
function parseGamesStack() {
    parseNextGames();
}

/**
 * Do HTTP request 
 * @param string address
 * @param function callback
 * @callback callback
 */
function getPage (someUri, callback) {
    request = require('request');
    request({uri: someUri}, function (error, response, body) {
        callback(body);
    });
}

st.addListener("data", function(d) {
    isDone = false;
    
    if (!isDone && curSeason == null) {
        // Set var for Season
        curSeason = d;
        sys.print("Matchday to start from: ");
        
        isDone = true;
    }
    
    if (!isDone && curSeason != null && curMatchday == null) {
        // Set var for Match
        curMatchday = d;
        sys.print("Last Matchday to get: ");
        
        isDone = true;
    }
    
    if (!isDone && curSeason != null && curMatchday != null && curLimit == null) {
        // Set var for Limit
        curLimit = d;
        fetchGames(curSeason, curMatchday, curLimit);
        
        isDone = true;
    }    
    
    
}).addListener("end", function() {

});

sys.print("Which Season (for 2010/2011 enter 2011): ");
