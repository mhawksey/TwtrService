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

var VERSION = "6.1.6";
var TwtrService = null;
var MASTERTAGS = "1EqFm184RiXsAA0TQkOyWQDsr4eZ0XRuSFryIDun_AA4";
var MASTERSHEETS_NEW = "1y4GwWs8tDRoS0Hg8t-kZfx2wg1Jfjw3u4CkqS1TzXCs";
var MASTERSHEETS_OLD = "0AqGkLMU9sHmLdExOcE1FbzNadGdEUlhTRE1keHd1N0E";

/**
 * @OnlyCurrentDoc
 */

/* 
/* Example TwtrService setup with authentication initialisation
*/

var consumer = { consumerKey    : getStaticScriptProperty_('consumerKey') || null, 
                 consumerSecret : getStaticScriptProperty_('consumerSecret') || null,
                 propertyStore  : PropertiesService.getUserProperties(),
                 serviceProvider: { name                : "twitter",
                                    requestTokenURL     : "https://api.twitter.com/oauth/request_token",
                                    userAuthorizationURL: "https://api.twitter.com/oauth/authorize", 
                                    accessTokenURL      : "https://api.twitter.com/oauth/access_token",
                                    scriptId          : "1OInPb-MLSnB_sTfav-OmgCSwF0u8rGFQWKfgmEXeSQs8o6FPiX10nJaP"},
              };

/* Set up the API root URL. */
var HOST = 'https://api.twitter.com/1.1/';
var UPLOAD_HOST = 'https://upload.twitter.com/1.1/';
var SERVICE_URL = getStaticScriptProperty_("service_url");
/* Respons format. */
var FORMAT = 'json';
var H = 380, W = 570;

// Because we want to use this script to also authenticate access when we call TwtrService.init() we store the service_url used to start the auth flow
//var SERVICE_URL = TwtrService.init(config);  


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
  menuEntries.push({name: "Build archive from tweet IDs", functionName: "rebuildArchiveFromIds"});
  menuEntries.push(null); // line separator
  menuEntries.push({name: "Add Summary Sheet", functionName: "addSummarySheet"});
  menuEntries.push({name: "Add Dashboard Sheet", functionName: "addDashboardSheet"});
  menuEntries.push(null); // line separator
  menuEntries.push({name: "Run Now!", functionName: "getTweets"});
  return menuEntries;
}

function getTwitterService_() {
  var service = OAuth1.createService(consumer.serviceProvider.name);
  service.setAccessTokenUrl(consumer.serviceProvider.accessTokenURL)
  service.setRequestTokenUrl(consumer.serviceProvider.requestTokenURL)
  service.setAuthorizationUrl(consumer.serviceProvider.userAuthorizationURL)
  service.setConsumerKey(consumer.consumerKey);
  service.setConsumerSecret(consumer.consumerSecret);
  //service.setProjectKey(consumer.serviceProvider.projectKey);
  service.setCallbackFunction('authCallback');
  service.setPropertyStore(consumer.propertyStore);
  return service;
}

/**
* Generate Twitter authorisation url.
*
* @return {string} authorisation url (link for user to start twitter authentication).
*/
function getTwitterAuthURL_() {
  var twitterService = getTwitterService_();
  var authorizationUrl = twitterService.getCallbackUrl(consumer.scriptId);
  return "<a href='"+authorizationUrl+"' target='_blank' onclick='google.script.host.close();'><img src='https://g.twimg.com/dev/sites/default/files/images_documentation/sign-in-with-twitter-gray.png'/></a>";
}

/**
* Handles the OAuth callback..
*
* @param {Object} request object from Twitter callback
* @param {string} stepTemplate The template file to render
*/
function authCallback(request) {
  var twitterService = getTwitterService_();
  var isAuthorized = twitterService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutputFromFile('auth_result').setTitle('Twitter Authorisation Complete');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

/**
* Show auth window (private).
*
* @param {Object} doctype Instigator service (Document App || Spreadsheet App etc)
* @return {UI} returns UI
*/
function showDialog_(optDoctype, stepTemplate){
  var doctype = optDoctype || false;
  try {
    var html = HtmlService.createTemplateFromFile(stepTemplate)
                  .evaluate()
                  .setSandboxMode(HtmlService.SandboxMode.IFRAME)
                  .setHeight(H).setWidth(W);
    if (!doctype){
      return html;
    }
    doctype.getUi().showModalDialog(html, "Twitter Authorisation"); 
  } catch(e) {
    throw (e);
  }
}

/**
* Show auth window for a SpreadsheetApp.
* 
* @param {SpreadsheetApp} doc The Document or Spreadsheet the library is being called from.
*/
function showTwitterLogin(doc){
  return showDialog_(doc, '1_auth_type');
}

/**
* Show auth window for a SpreadsheetApp.
* 
* @param {SpreadsheetApp} doc The Document or Spreadsheet the library is being called from.
*/
function showTwitterKeyForm(doc){
  return showDialog_(doc, '1b_cred_pop');
}

/**
* Show auth window for a SpreadsheetApp.
* 
* @param {SpreadsheetApp} doc The Document or Spreadsheet the library is being called from.
*/
function showTwitterLaunch(doc){
  return showDialog_(doc, '2_start_auth');
}

/**
* Script service to handle authentication flow.
*
* @return {HTMLService}
*/
function doGet(e){
  var w = HtmlService.createTemplateFromFile('3_auth_pop');
  w.parameters = e.parameters;
  return w.evaluate()
          .setSandboxMode(HtmlService.SandboxMode.IFRAME)
          .setHeight(320).setWidth(600)
          .setTitle('Twitter Authorisation');
}

/**
* Test if user has authenticated with Twitter.
*
* @return {boolean} Return true if user is authenticated.
*/
function isUserConnectedToTwitter(){
  var twitterService = getTwitterService_();
  if (twitterService.hasAccess()) {
    return true;
  }
}

/**
* Disconnect user from Twitter.
*
*/
function disconnectTwitter(){
  OAuth1.createService('twitter')
      .setPropertyStore(PropertiesService.getUserProperties())
      .reset();
  deleteStaticUserProperty_('consumerKey');
  deleteStaticUserProperty_('consumerSecret');
}

/**
* Set library user key/secret
*
* @param {object} formObject Key and secret from credenitals popup
*/
function setUserKeySecret(formObject){
  setStaticUserProperty_('consumerKey', formObject.consumerKey.trim());
  setStaticUserProperty_('consumerSecret', formObject.consumerSecret.trim());
}

/**
* Get library user key.
* @return {string} twitter key
*/
function getUserKey(){
  return getStaticUserProperty_('consumerKey');
}

/**
* Get library user secret.
* @return {string} twitter secret
*/
function getUserSecret(){
  return getStaticUserProperty_('consumerSecret');
}

/**
 * Gets a static script property, using long term caching.
 * @param {string} key The property key.
 * @returns {string} The property value.
 */
function getStaticScriptProperty_(key) {
  var value = CacheService.getScriptCache().get(key);
  if (!value) {
    value = PropertiesService.getScriptProperties().getProperty(key);
    CacheService.getScriptCache().put(key, value, 21600);
  }
  return value;
}

/**
 * Gets a static user property, using long term caching.
 * @param {string} key The property key.
 * @returns {string} The property value.
 */
function getStaticUserProperty_(key) {
  var value = CacheService.getUserCache().get(key);
  if (!value) {
    value = PropertiesService.getUserProperties().getProperty(key);
    CacheService.getUserCache().put(key, value, 21600);
  }
  return value;
}

/**
 * Sets a static user property, using long term caching.
 * @param {string} key The property key.
 * @param {string} value The property value.
 */
function setStaticUserProperty_(key, value) {
  consumer[key] = value;
  PropertiesService.getUserProperties().setProperty(key, value)
  CacheService.getUserCache().put(key, value, 21600);
}

/**
 * Delete a static user property, using long term caching.
 * @param {string} key The property key.
 * @returns {string} The property value.
 */
function deleteStaticUserProperty_(key) {
  CacheService.getUserCache().remove(key);
  PropertiesService.getUserProperties().deleteProperty(key)
}