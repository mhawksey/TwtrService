// Copyright 2014 Martin Hawksey. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var VERSION = "6.0";
var TwtrService = null;
var MASTERTAGS = "1EqFm184RiXsAA0TQkOyWQDsr4eZ0XRuSFryIDun_AA4";
var MASTERSHEETS_NEW = "1y4GwWs8tDRoS0Hg8t-kZfx2wg1Jfjw3u4CkqS1TzXCs";
var MASTERSHEETS_OLD = "0AqGkLMU9sHmLdExOcE1FbzNadGdEUlhTRE1keHd1N0E";

/**
* Sets the TwtrService library being used.
*
* @param {TwtrService} aTwtrService a TwtrService library object.  
*/
function setTwtrService(aTwtrService){
  TwtrService = aTwtrService;
}

/**
* Set TAGS menu.
*
* @return {array} menuEntries used in onOpen.
*/
function setMenu(){
  var menuEntries = [];
  menuEntries.push({name: "Setup Twitter Access", functionName: "setup"});
  menuEntries.push({name: "Disconnect Twitter Access", functionName: "disconnectTwitter"});
  //menuEntries.push({name: "Set Default Folder", functionName: "setDefaultFolder"});
  menuEntries.push(null); // line separator
  menuEntries.push({name: "Delete Duplicate Data", functionName: "deleteDuplicates"});
  menuEntries.push({name: "Wipe Archive Sheet", functionName: "wipeArchive"});
  menuEntries.push(null); // line separator
  menuEntries.push({name: "Add Summary Sheet", functionName: "addSummarySheet"});
  menuEntries.push({name: "Add Dashboard Sheet", functionName: "addDashboardSheet"});
  menuEntries.push(null); // line separator
  menuEntries.push({name: "Run Now!", functionName: "getTweets"});
  return menuEntries;
}

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
  if (version.match(/os$/)){ // old sheets
    var ss_ID = MASTERSHEETS_OLD;
  } else {
    var ss_ID = MASTERSHEETS_NEW;
  }
  return SpreadsheetApp.openById(ss_ID).getSheetByName(sheetName).copyTo(doc).setName(sheetName);
}

/**
* Creates a new TAGS archive spreadsheet from the template master.
*
* @param {Sheet} sheet The sheet where the new template reference should be recorded.
*/
function newTAGS(sheet){
  var name = Browser.inputBox("Enter a suffix name for your new TAGS sheet:");
  if (name){
    var tempDoc = SpreadsheetApp.openById(MASTERTAGS);
    var newDoc = tempDoc.copy("TAGS v"+VERSION+ " - " +name);
    Utilities.sleep(1000);
    sheet.insertRowAfter(7);
    sheet.getRange(8, 1, 1, 3).setValues([[new Date(), name, newDoc.getId()]]);
    sheet.getRange(8, 4, 1, 2).setFormulas([['=HYPERLINK("https://docs.google.com/spreadsheets/d/"&C8&"/edit", "Open")', 
                                                  '=TRANSPOSE(IMPORTRANGE(C8,"Readme/Settings!B9:B22"))']]);
  }
}

function setDefaultFolder(){
  var folder_id = Browser.inputBox("Set Default Folder", 
                              "You are about to wipe the Archive sheet\\n\\nDo you want to continue?", 
                              Browser.Buttons.OK_CANCEL);
  if (folder_id !== "cancel"){
    PropertiesService.getUserProperties().setProperty("folder_id", folder_id);
  }
}

/**
* Creates a new TAGS archive spreadsheet from the template master.
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
      var responseData = TwtrService.get(type, queryParams);
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
              objects[i]["from_user"] = objects[i]["user_screen_name"];
              objects[i]["from_user_id_str"] = objects[i]["user_id_str"]
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
              done = true;
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
  var api_request = "application/rate_limit_status.json?resources=users,search,statuses";
  var data = TwtrService.get("application/rate_limit_status", {'resources': 'users,search,statuses,favorites'});
  var output = {};
  output.search = data.resources.search["/search/tweets"];
  output.user_id = data.resources.users["/users/show/:id"];
  output.user_lookup = data.resources.users["/users/lookup"];
  output.favorites = data.resources.favorites["/favorites/list"];
  output.statuses_embeds = data.resources.statuses["/statuses/oembed"];
  
  Browser.msgBox(JSON.stringify(output,"","\t"));
  Logger.log(data);
  return data;
}

/**
* Test rate limits from Twitter.
*
* @param {Object} options used in Twitter API call
* @param {string} type of Twitter call
* @return {Object} params used in Twitter API call
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