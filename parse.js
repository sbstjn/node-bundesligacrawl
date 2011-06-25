var sys = require("sys");
var st = process.openStdin();

var DEF_CURRENT_SEASON  = 2012;
var DEF_CURRENT_PATH    = 'http://dfl.de/de/inc/spieltage/liga/{SPIELTAG}.html?666';
var DEF_ARCHIVE_PATH    = 'http://dfl.de/data/analysis/de/22/{SAISON}/fixtures/{SPIELTAG}.htm?666';
var DEF_MODE_CURRENT    = 'current';
var DEF_MODE_ARCHIVE    = 'archive';
var DEF_ARCHIVE_MAPPING = {2011: 2010, 2010: 2009, 2009: 2008, 2008: 8, 2007: 7, 2006: 6, 2005: 5, 2004: 4, 2003: 3, 2002: 2, 2001: 1, 2000: 10};

var curSeason   = null;
var curMatchday = null;
var curLimit    = null;
var curMode     = null;
var urlStack    = new Array();
var matchday    = new Array();

/**
 * Custom DB Import for xaleo.de
 **/
var Client = require('mysql').Client,
    client = new Client();

client.user     = 'USERNAME';
client.password = 'PASSWORD';
client.host     = 'HOSTNAME';
client.connect();
client.query('USE DATABASE');

/** 
 * Get matchdays from Bundesliga 
 * @param int thisSeason season
 * @param int thisMatchday matchday to start from
 * @param int thisLimit last matchday to get
 * @return array of matchdays containing array of matchday objects
 */
function fetchGames(thisSeason, thisMatchday, thisLimit) {
    // Set variables for different html responses 
    if (thisSeason == DEF_CURRENT_SEASON) {
        baseURL = DEF_CURRENT_PATH;  
        curMode = DEF_MODE_CURRENT;
    } else {
        thisSeason = DEF_ARCHIVE_MAPPING[thisSeason*1];
        baseURL = DEF_ARCHIVE_PATH;
        curMode = DEF_MODE_ARCHIVE;
    }

    if (thisSeason == null) {
        console.log('****');
        console.log('* Sorry, but no mapping for this season available.');
        console.log('* See README.mapping for more information');
        console.log('****');
    } else {
        // create stack of matchdays
        for (var i = thisMatchday; i <= thisLimit; i++) {
            thisURL = baseURL.replace('{SPIELTAG}', i*1);
            thisURL = thisURL.replace('{SAISON}', thisSeason);
            
            urlStack.push({matchday: i*1, url: thisURL});
        }
        
        // start parsing stack
        parseGamesStack();
    }
}

/**
 * Parse next available matchday or call finish method 
 */
function parseNextGames() {
    if (urlStack.length > 0) {
        curObject   = urlStack.shift();
        curMatchday = curObject.matchday;

        getPage(curObject.url, function(body) {
            // Parse current season, this needs some different handling
            if (body.indexOf('<body') == '-1') {           
                var html    = "<!doctype html><html><body>" + body + "</body></html>";            
                var window  = require('jsdom').jsdom(html, null, { FetchExternalResources: false, ProcessExternalResources: false, MutationEvents: false, QuerySelector: false }).createWindow();
                var $       = require('jquery').create(window);
                var $       = require('jquery').create(window);

                $("tr").each( function(el) {
                    if ($(this).find('.tn01').first() != null) {
                        curDatum = $(this).find('.tn01').first().text();
                        if (curDatum != 'Datum' && curDatum != '' && curDatum != null) {

                            curMatch = {
                                day:        curMatchday
                              , date:       curDatum                             
                              , time:       $(this).find('.tn02').first().text() 
                              , home:       $(this).find('.tn03').first().text() 
                              , guest:      $(this).find('.tn05').first().text() 
                              , result:     $(this).find('.tn06').first().text() 
                            };

                            if (curMatch.date != null && curMatch.time != null && curMatch.home != null && curMatch.guest != null && curMatch.result != null) {
                                matchday.push(curMatch);
                            }
                        }
                    }
                });

                // Start next matchday
                parseNextGames();
            }
        });
    } else {
        finishGames();
    }
}

/** 
 * Finish games
 */
function finishGames() {
    if (matchday.length > 0) {
        parseNextGameIntoDB();
    } else {
        console.log('finished…');
    }
}

function parseNextGameIntoDB() {
    if (matchday.length == 0) {
        console.log('done');
    } else {
        var nextGame = matchday.shift();
        var thisHome = nextGame.home;
        thisHome = thisHome.replace("'", "\\'");
        client.query("SELECT * FROM tipp_teams WHERE team = '" + thisHome + "' ",
            function selectCb(err, results, fields) {
                if (err) {
                    throw err;
                }
                
                if (results[0]) {
                    var thisHomeID = results[0].id;
                    
                    var thisGuest = nextGame.guest;
                    thisGuest = thisGuest.replace("'", "\\'");
                    client.query("SELECT * FROM tipp_teams WHERE team = '" + thisGuest + "' ",
                        function selectCb(err, results, fields) {
                            if (err) {
                                throw err;
                            }
                            
                            if (results[0]) {                                
                                var tmpDate = nextGame.date;
                                    tmpDate = tmpDate.split('.');
                                var currentTimeStamp = tmpDate[2] + '-' + tmpDate[1] + '-' + tmpDate[0] + ' ' + nextGame.time + ':00';
                                var insertQuery = "INSERT INTO tipp_spiele (`saison`, `spieltag`, `datum`, `heim_id`,`gast_id`) VALUES ('" + curSeason*1 + "', '" + nextGame.day + "', '" + currentTimeStamp + "', '" + thisHomeID*1 + "', '" + results[0].id*1 + "');";
                                
                                console.log(insertQuery);
                                
                                parseNextGameIntoDB();
                            } else {
                                parseNextGameIntoDB();
                            }
                        }
                    );
                }
            }
        );
    }
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

sys.print("Season (2000 - 2012): ");