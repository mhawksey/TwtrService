/**
* Collects data from Twitter API and writes to sheet.
*
* @param {SpreadsheetApp} doc The spreadsheet document instigating collectTweets where data will be written. 
* @param {Object} optParams Optional advanced query parameters to pass in to Twitter API e.g. {"geocode": "40.714353,-74.005973,30mi"}. 
*/
function collectTweets(doc, optParams){
  var params = optParams || {};
  var settingsSheet = doc.getSheetByName("Readme/Settings");
  var SEARCH_TERM = settingsSheet.getRange("B9").getValue();
  var settings = getSettingsData_(settingsSheet.getRange("A13:B17"));
  var sheetName = "Archive";
  if (!doc.getSheetByName(sheetName)){
    var sheet = addSheet(doc, "Archive");
  } else {
    var sheet = doc.getSheetByName(sheetName);
  }
  
  var since_id = false;
  var id_strs = sheet.getRange(2, 1, settings.numberOfTweets+1).getValues();
  for (r in id_strs){
    if (id_strs[r][0] != ""){
      since_id = id_strs[r][0];
      break;
    }
  }
  params.q = SEARCH_TERM;
  params.settings = settings;
  
  //if no since id grab search results
  if (since_id){
    params.sinceid = since_id; // get results from twitter sinceid
  } 
  if(!settings.type) settings.type = "search/tweets";
  var data = getTweets_(params, settings.type);
   // if some data insert rows
  if (data.length>0){
    sheet.insertRowsAfter(1, data.length);
    setRowsData_(sheet, data);
  }  
}

/**
* Adds a named sheet from the Master template to current spreadsheet.
*
* @param {SpreadsheetApp} doc The spreadsheet document to add sheet to.
* @param {string} sheetName The name of the sheet to add.
* @param {string} version The version of TAGS calling the function.
* @return {Sheet} returns sheet for key chaining
*/
function addSheet(doc, sheetName, version){
  //var ss_ID = MASTERSHEETS_NEW;
  if (!doc.getSheetByName(sheetName)){
    Browser.msgBox("The "+sheetName+" sheet has been deleted or renamed. If deleted it can be copied from https://goo.gl/BtWxry")
  } else {
    return doc.getSheetByName(sheetName).showSheet().activate();
  }
  //return SpreadsheetApp.openById(ss_ID).getSheetByName(sheetName).copyTo(doc).setName(sheetName);
}

/**
* Get Tweets from API.
*
* @private
* @param {Object} params The query parameters.
* @param {string} type The type of API call to do.
*/
function getTweets_(params, type) {
  var queryParams = getQueryParams_(params, type);
  var numTweets = params.settings.numberOfTweets;
  if (numTweets > 18000)  numTweets = 18000;
  var maxPage = Math.ceil(numTweets/queryParams.count);
  var data = [];
  var idx = 0;
  try {
    var max_id = "";
    var max_id_url = "";
    var page = 1;
    var done = false;
    var maxid_str = "";
    
    while(!done){
      var responseData = get(type, queryParams);
      if (responseData.message){
        Logger.log(responseData.message);
        Browser.msgBox("Error", responseData.message, Browser.Buttons.OK);
        done = true;
      } else {
        if (responseData.statuses !== undefined){
          var objects = responseData.statuses;
        } else {
          var objects = responseData;
        }
        
        if (objects.length>0){ // if data returned
          for (i in objects){ // for the data returned we put in montly bins ready for writting/updating files
            if(params.settings.followerCountFilter == 0 || objects[i].user.followers_count >= params.settings.followerCountFilter){
              if (objects[i].geo != null){
                objects[i]["geo_coordinates"] = "loc: "+objects[i].geo.coordinates[0]+","+objects[i].geo.coordinates[1];
              }
              for (j in objects[i].user){
                objects[i]["user_"+j] = objects[i].user[j];
              }
              if (objects[i]["user_url"] !== null){
                objects[i]["user_url"] = objects[i].user.entities.url.urls[0].expanded_url;
              }
              objects[i]["from_user"] = objects[i]["user_screen_name"];
              if (!objects[i]["retweeted_status"]) {
                objects[i]["text"] = objects[i]["full_text"];
              } else {
                objects[i]["text"] = "RT @"+objects[i]["retweeted_status"]['user']['screen_name']+": "+objects[i]["retweeted_status"]["full_text"];
              }
              objects[i]["from_user_id_str"] = objects[i]["user_id_str"];
              objects[i]["profile_image_url"] = objects[i]["user_profile_image_url"];
              objects[i]["status_url"] = "http://twitter.com/"+objects[i].user_screen_name+"/statuses/"+objects[i].id_str;
              objects[i]["time"] = new Date(objects[i]["created_at"]);
              objects[i]["entities_str"] = JSON.stringify(objects[i]["entities"]);
              if (i < queryParams.count-1){
                data[idx]=objects[i];
                idx ++;
              } 
            }
          }
          if(responseData.search_metadata !== undefined) {
            if (responseData.search_metadata.max_id_str == objects[objects.length-1]["id_str"]){
              done = true;
            }
          } else {
            if (objects[objects.length-1]["id_str"] === data[data.length-1]["id_str"]){
              //done = true;
            }
          }
          queryParams.max_id = objects[objects.length-1]["id_str"];
        } else { // if not data break the loop
          Logger.log("no objects");
          done = true;
        }
        page ++;
        if (page > maxPage) done = true; // if collected 16 pages (the max) break the loop
      } 
    } //end of while loop
    return data;
  } catch (e) {
    Browser.msgBox("Line "+e.lineNumber+" "+e.message+e.name);
    //Browser.msgBox("Line "+e.lineNumber+" "+e.message+e.name);
    ScriptProperties.setProperty("errormsg","Line "+e.lineNumber+" "+e.message+e.name);
    return;
  }
} 

/**
* Sets the list of currect importable Twitter API endpoints.
*
* @param {SpreadsheetApp} doc The TAGS spreadsheet document.
*/
function setArchiveTypesList(doc){
  var cell = doc.getSheetByName("Readme/Settings").getRange('B17');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(['search/tweets', 
                                                                    'favorites/list',
                                                                    'statuses/user_timeline']).build();
  cell.setDataValidation(rule);
}

/**
* Returns count of tweets with most RTs.
* 
* @param {array} tweets array [id_str, from_user, text]
* @return {array} [][] 2d JavaScript array of filtered data
*/
function filterUnique(tweets){
  try {
    var output = [];
    var temp = {};
    tweets.reverse();
    for (i in tweets){
      if (tweets[i][2] !="text"){
        if (i>0){
          var tmp = tweets[i][2];
          var urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
          tmp = tmp.replace(urlPattern,"")
          tmp = tmp.substring(0,parseInt(tmp.length*0.9));
          var link = "http://twitter.com/"+tweets[i][1]+"/statuses/"+tweets[i][0].trim();
          if (temp[tmp] == undefined){
            temp[tmp] = [tweets[i][2],0,link];
          }
          temp[tmp] = [tweets[i][2],temp[tmp][1]+1,link]; 
          //output.push([tmp]);
        }
      }
    }
    for (i in temp){
      output.push([temp[i][0],temp[i][1],temp[i][2]]);
    }
    output.sort(function(a,b) {
      return  b[1]-a[1];
    });
    return output.slice(0, 12);
  } catch(e) {
    return "--";
  }
}

/**
* Test rate limits from Twitter.
*
* @return {Object} data of Twitter rates
*/
function testRate(){
  //var api_request = "application/rate_limit_status.json?resources=users,search,statuses";
  var data = get("application/rate_limit_status", {'resources': 'users,search,statuses'});
  return data;
}

/**
* Get API query params.
*/
function getQueryParams_(options, type) {    
  var params = {};
  if (type == "search/tweets"){
    //defaults
    params.q = options.q;
    params.count = options.count || 100;
    params.result_type = options.result_type || "recent";
    params.include_entities = options.include_entities || 1;
    if (options.sinceid != undefined) {
      params.since_id = options.sinceid;
    } 
    if (options.lang != undefined) {
      params.lang= options.lang;
    }
    if (options.geocode != undefined) {
      params.geocode= options.geocode;
    }
    
    var SEARCH_DURATION = options.settings.period;
    // prepare search term
    if (SEARCH_DURATION != "default"){
      var period = parseInt(SEARCH_DURATION.replace(/\D/g,""))-1;
      var until=new Date();
      until.setDate(until.getDate()-period);
      var since = new Date(until);
      since.setDate(since.getDate()-1-period);
      params.since = twDate_(since);
      params.until = twDate_(until);
    }
    
  } else {
    params.count = options.count || 200;
    if (options.q !== ""){
      params.screen_name = options.q;
    }
    if (options.sinceid != undefined) {
      params.since_id = options.sinceid;
    } 
    params.include_entities = options.include_entities || true;
  }
  return params;
}

/**
* Delete duplicate data from sheet based on first column.
*
* @param {Sheet} sheet Sheet with duplicate data 
*/
function deleteDuplicates(sheet) {
  var dups = {};
  var rows = [];
  var toDelete = [];
  var id_strs = sheet.getRange(1, 1, sheet.getLastRow()).getValues();
  var row = id_strs.length;
  for (r in id_strs){
    var id_str = id_strs[r][0].trim();
    if (dups[id_str] == undefined){
      dups[id_str] = 1;
    } else {
      rows.push(parseInt(r));
    }
    row--;
  }
  // http://stackoverflow.com/a/3844632/1027723
  var count = 0;
  var firstItem = 0; // Irrelevant to start with
  for (x in rows) {
    // First value in the ordered list: start of a sequence
    if (count == 0) {
      firstItem = rows[x];
      count = 1;
    }
    // Skip duplicate values
    else if (rows[x] == firstItem + count - 1) {
      // No need to do anything
    }
    // New value contributes to sequence
    else if (rows[x] == firstItem + count) {
      count++;
    }
    // End of one sequence, start of another
    else {
      if (count >= 3) {
        Logger.log("Found sequence of length "+count+" starting at "+firstItem);
        toDelete.push([firstItem+1,count]);
      }
      count = 1;
      firstItem = rows[x];
    }
  }
  if (count >= 3) {
    Logger.log("Found sequence of length "+count+" starting at "+firstItem);
    toDelete.push([firstItem+1,count]);
  }
  toDelete.reverse();
  for (r in toDelete){
    var resp = Browser.msgBox("Delete duplicate rows "+toDelete[r][0]+" to "+(parseInt(toDelete[r][0])+parseInt(toDelete[r][1])), Browser.Buttons.OK_CANCEL);
    if (resp == "ok") sheet.deleteRows(toDelete[r][0], toDelete[r][1]);
  }
}

/**
* Formats date object for Twiiter API call.
*
* @param {Date} aDate Date object
* @return {string} Formatted date 
*/
function twDate_(aDate){
  return Utilities.formatDate(aDate, "GMT", "yyyy-MM-dd");
}

/**
* Rebuilds a Twitter archive from Twitter IDs.
* @param {SpreadsheetApp} doc The spreadsheet document instigating collectTweets where data will be written. 
* @param {Object} optParams Optional advanced parameters"}. 
*
*/
function rebuildArchiveFromIds(doc, optParams){
  //var doc = SpreadsheetApp.getActiveSpreadsheet();
  var out = {};
  // get IDs sheet
  if (!doc.getSheetByName('ID')){
    Browser.msgBox('Build archive from tweet IDs', 
                   "This function needs a sheet named 'ID' containing a list of tweet IDs in column A.\\n\\n" +
                   "A sheet named 'ID' has been created for you", 
                   Browser.Buttons.OK);
    doc.insertSheet('ID', 3);
    return;
  }
  var result = Browser.msgBox("Data Setup", 
                              "Does your ID sheet contain a header row", 
                              Browser.Buttons.YES_NO);
  // Process the user's response.
  if (result == 'yes') {
    var start_row = 2;
  } else {
    var start_row = 1;
  }
  var sheet_ids = doc.getSheetByName('ID');
  try {
    var ids_in = sheet_ids.getRange(start_row,1,sheet_ids.getLastRow(),2).getValues();
    sheet_ids.getRange(start_row,1,sheet_ids.getLastRow(),1).setNumberFormat("@");
  } catch(e) {
    Browser.msgBox('It looks like you have no IDs in column A');
    return;
  }
  var ids = [];
  var imported_ids = {};
  for (var i=0; i<ids_in.length; i++){
    if (ids_in[0]!=="" && ids_in[1] !=="Y"){
      ids.push(ids_in[i][0]);
      imported_ids[ids_in[i][0]] = 'N';
    }
  }
  if (ids.length === 0){
    return; 
  }
  var chunks = chunk_(ids,100);
  
  var quoatas = testRate();
  var status_quota = quoatas.resources.statuses['/statuses/lookup'];
  var doTrigger = false;
  
  if (status_quota.remaining > chunks.length){
    var loops = chunks.length;
  } else {
    var loops = status_quota.remaining;
    var doTrigger = true;
  }
  for (var j = 0; j < loops; j++){
  // if (status_quota.remaining > chunks.length){
    var sheet = doc.getSheetByName("Archive");
    var data = [];
    var idx = 0;
    var chunks = chunk_(ids,100);
    for (j in chunks){
      try {
        var objects = get("statuses/lookup", {include_entities:true, tweet_mode: 'extended', id: chunks[j].join()});
        for (i in objects){          
          if (objects[i].geo != null){
            objects[i]["geo_coordinates"] = "loc: "+objects[i].geo.coordinates[0]+","+objects[i].geo.coordinates[1];
          }
          for (o in objects[i].user){
            objects[i]["user_"+o] = objects[i].user[o];
          }
          if (objects[i]["user_url"] !== null){
            objects[i]["user_url"] = objects[i].user.entities.url.urls[0].expanded_url;
          }
          objects[i]["from_user"] = objects[i]["user_screen_name"];
          if (!objects[i]["retweeted_status"]) {
            objects[i]["text"] = objects[i]["full_text"];
          } else {
            objects[i]["text"] = "RT @"+objects[i]["retweeted_status"]['user']['screen_name']+": "+objects[i]["retweeted_status"]["full_text"];
          }
          objects[i]["from_user_id_str"] = objects[i]["user_id_str"]
          objects[i]["profile_image_url"] = objects[i]["user_profile_image_url"];
          objects[i]["status_url"] = "http://twitter.com/"+objects[i].user_screen_name+"/statuses/"+objects[i].id_str;
          objects[i]["time"] = new Date(objects[i]["created_at"]);
          objects[i]["entities_str"] = JSON.stringify(objects[i]["entities"]);
          data[idx]=objects[i];
          imported_ids[objects[i]["id_str"]] = 'Y';
          idx ++;          
        }
      } catch(e) {
        Browser.msgBox(e);
      }
    }
    if (data.length>0){
      sheet.insertRowsAfter(1, data.length);
      setRowsData_(sheet, data);
      for (var i=0; i<ids_in.length; i++){
        if (imported_ids[ids_in[i][0]] == 'Y'){
          ids_in[i][1] = 'Y';
        }
      }
      sheet_ids.getRange(start_row,1,ids_in.length,2).setValues(ids_in);
    }
  }
  if (doTrigger){
    // setup script trigger to run script 
    return {status: 'set trigger', msg: 'You\'ve run out of quota. This script will resume when reset at '+new Date(status_quota.reset*1000), time: status_quota.reset};
  } else {
    // finish 
    return {status: 'ok', msg: 'Tweets have been imported to the Archive sheet'};
  }
 
}

// http://jsfromhell.com/array/chunk
function chunk_(a, s){
    for(var x, i = 0, c = -1, l = a.length, n = []; i < l; i++)
        (x = i % s) ? n[c][x] = a[i] : n[++c] = [a[i]];
    return n;
}