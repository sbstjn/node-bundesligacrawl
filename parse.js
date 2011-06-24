var sys = require("sys");
var st = process.openStdin();

var DEF_CURRENT_SAISON  = 2011;
var DEF_CURRENT_PATH    = 'http://dfl.de/de/inc/spieltage/liga/{SPIELTAG}.html?123';
var DEF_ARCHIVE_PATH    = 'http://dfl.de/de/liga/saisonrueckblick/{SAISON}/spieltag{SPIELTAG}.php';
var DEF_INPUT_OFFSET    = -1;
var DEF_MODE_CURRENT    = 'current';
var DEF_MODE_ARCHIVE    = 'archive';

var curSaison   = null;
var curSpieltag = null;
var curLimit    = null;
var curMode     = null;
var urlStack    = new Array();
var matchday    = new Array();

/** 
 * Get games from Bundesliga 
 * @param int thisSaison season
 * @param int thisSpieltag match day to start from
 * @param int thisLimit limit how much data to get
 * @return list of games
 */
function fetchGames(thisSaison, thisSpieltag, thisLimit) {
    thisSaison = thisSaison*1 + DEF_INPUT_OFFSET*1;
    
    // Set variables for different html responses 
    if (thisSaison == DEF_CURRENT_SAISON) {
        baseURL = DEF_CURRENT_PATH;  
        curMode = DEF_MODE_CURRENT;
    } else {
        baseURL = DEF_ARCHIVE_PATH;
        curMode = DEF_MODE_ARCHIVE;
    }

    // create stack of matchdays
    maxSpieltag = thisSpieltag*1 + thisLimit*1;
    for (var i = thisSpieltag; i < maxSpieltag; i++) {
        thisURL = baseURL.replace('{SPIELTAG}', i*1);
        thisURL = thisURL.replace('{SAISON}', thisSaison);
        
        urlStack.push({spieltag: i*1, url: thisURL});
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
        curSpieltag = curObject.spieltag;
        
        if (matchday[curSpieltag] == null) {
            matchday[curSpieltag] = new Array();
        }
        
        getPage(curObject.url, function(body) {
            var html = "<!doctype html><html><body><h1>hello</h1>" + body + "</body></html>";
            
            var window = require('jsdom').jsdom(html, null, { FetchExternalResources: false, ProcessExternalResources: false, MutationEvents: false, QuerySelector: false }).createWindow();
            var $ = require('jquery').create(window);
            var $ = require('jquery').create(window);

            $("tr").each( function(el) {
                curDatum = $(this).find('.tn01').first().text();
                if (curDatum != 'Datum' && curDatum != '') {
                    curMatch = {
                        date:       curDatum                             
                      , time:       $(this).find('.tn02').first().text() 
                      , heim:       $(this).find('.tn03').first().text() 
                      , gast:       $(this).find('.tn05').first().text() 
                      , result:     $(this).find('.tn06').first().text() 
                    };
                
                    matchday[curSpieltag].push(curMatch);
                }
            });
            
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
    
    if (!isDone && curSaison == null) {
        // Set var for Saison
        curSaison = d;
        sys.print("Spieltag: ");
        
        isDone = true;
    }
    
    if (!isDone && curSaison != null && curSpieltag == null) {
        // Set var for Spieltag
        curSpieltag = d;
        sys.print("Limit: ");
        
        isDone = true;
    }
    
    if (!isDone && curSaison != null && curSpieltag != null && curLimit == null) {
        // Set var for Limit
        curLimit = d;
        fetchGames(curSaison, curSpieltag, curLimit);
        
        isDone = true;
    }    
    
    
}).addListener("end", function() {

});

sys.print("Season (for 2010/2011 enter 2011): ");
