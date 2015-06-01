// Copyright 2014 Google Inc. All Rights Reserved.
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

/* This code was orignally developed by Arun Nagarajan https://plus.google.com/+ArunNagarajan/ 
*  and extended by Martin Hawksey https://plus.google.com/+MartinHawksey 
*/

var consumer = { consumerKey    : getStaticUserProperty_('consumerKey') || null, 
                 consumerSecret : getStaticUserProperty_('consumerSecret') || null, 
                 serviceProvider: { signatureMethod     : "HMAC-SHA1",
                                    requestTokenURL     : "https://api.twitter.com/oauth/request_token",
                                    userAuthorizationURL: "https://api.twitter.com/oauth/authorize", 
                                    accessTokenURL      : "https://api.twitter.com/oauth/access_token" },
              };

/* Set up the API root URL. */
var HOST = 'https://api.twitter.com/1.1/';
var UPLOAD_HOST = 'https://upload.twitter.com/1.1/';
/* Respons format. */
var FORMAT = 'json';
/* Managed Library Script Id (for user callback) */
var SCRIPT_ID = "MarIlVOhstkJA6QjPgCWAHIq9hSqx7jwh";
var SERVICE_URL = getStaticScriptProperty_("service_url");
var HASH = getStaticScriptProperty_('hash');
var INITIALISED_SIG = "";
var H = 380, W = 600;



/**
* Initialise script variables.
*
* @param {Object} config Override for consumer object. Parameters {consumerKey: "string", consumerSecret: "string"}.  
* @return {string} Service url for signing in with Twitter.
*/
function init(config){
  consumer.consumerKey = config.consumerKey;
  consumer.consumerSecret = config.consumerSecret;
  INITIALISED_SIG = oauthlibrary.hex_hmac_sha1(HASH, consumer);
  setStaticUserProperty_(INITIALISED_SIG, JSON.stringify(consumer));
  SERVICE_URL += "?signature="+INITIALISED_SIG;
  return SERVICE_URL;
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

/**
* Generate Twitter authorisation url.
*
* @return {string} authorisation url (link for user to start twitter authentication).
*/
function getTwitterAuthURL_(signature) {
  if (signature){
    INITIALISED_SIG = signature;
    var accessor = JSON.parse(getStaticUserProperty_(signature));
  } else {
    var accessor = consumer;
  }
  var message = {
    method: "post", action: accessor.serviceProvider.requestTokenURL
    , parameters: [["oauth_callback", getCallbackURL_('handleTwitterCallback_')]]
  };
  var requestBody = oauthlibrary.OAuth.formEncode(message.parameters);
  oauthlibrary.OAuth.completeRequest(message, accessor);
  var authorizationHeader = oauthlibrary.OAuth.getAuthorizationHeader("", message.parameters);
  
  var tokenOptions = {
    "method" : message.method,
    "headers" : {"Authorization" : authorizationHeader},
    "muteHttpExceptions" : true
  };
  var requestTokenResponse = UrlFetchApp.fetch(message.action, tokenOptions);
  if (requestTokenResponse.getResponseCode() != "200"){
    return "<strong>Oops something went wrong</strong>. Twitter says:"+ requestTokenResponse.getContentText();
  }
  var tokenProperties = requestTokenResponse.getContentText().split('&');
  var authorizeURL = 'https://api.twitter.com/oauth/authorize?'+tokenProperties[0];
  return "<a href='"+authorizeURL+"' target='_blank' onclick='google.script.host.close();'><img src='https://g.twimg.com/dev/sites/default/files/images_documentation/sign-in-with-twitter-gray.png'/></a>";
}

/**
* Get user callback url with state token.
*
* @param {string} callback Callback method name.
* @return {string} Callback url.
*/
function getCallbackURL_(callback) {
  var signature = "";
  var state = ScriptApp.newStateToken().withTimeout(3600).withMethod(callback).createToken();
  if (INITIALISED_SIG != ""){
    signature = "&signature="+oauthlibrary.hex_hmac_sha1(HASH, consumer);
  }
  var url = getStaticScriptProperty_("service_url");
  url = url.slice(0, -4) + 'usercallback?state='; // Change /exec to /usercallback
  return url+state+signature;
}

/**
* Test if user has authenticated with Twitter.
*
* @return {boolean} Return true if user is authenticated.
*/
function isUserConnectedToTwitter(){
  if (getStaticUserProperty_('screen_name'+INITIALISED_SIG)){
    return true;
  }
}

/**
* Handle temporary authtication callback from Twitter to get token/secret.
*
* @param {Object} e.
* @return {HTMLService} html window.
*/
function handleTwitterCallback_(e){
  var signature = e.parameters.signature;
  if (signature){
    var accessor = JSON.parse(getStaticUserProperty_(signature));
  } else {
    var accessor = consumer;
    signature = "";
  }
  var message = {
    method: "post", action: accessor.serviceProvider.accessTokenURL
    , parameters: [["oauth_verifier", e.parameters.oauth_verifier],["oauth_token", e.parameters.oauth_token]]
  };
  var requestBody = oauthlibrary.OAuth.formEncode(message.parameters);
  oauthlibrary.OAuth.completeRequest(message, accessor);
  var authorizationHeader = oauthlibrary.OAuth.getAuthorizationHeader("", message.parameters);
  
  var tokenOptions = {
    "method" : message.method,
    "payload" : requestBody,
    "headers" : {"Authorization" : authorizationHeader}
  };
  var accessTokenResponse = UrlFetchApp.fetch(message.action, tokenOptions);
  var results = accessTokenResponse.getContentText();
  
  var screen_name = oauthlibrary.OAuth.getParameter(results, "screen_name")
  var oauth_token = oauthlibrary.OAuth.getParameter(results, "oauth_token")
  var oauth_token_secret = oauthlibrary.OAuth.getParameter(results, "oauth_token_secret")
  setStaticUserProperty_('screen_name'+signature, screen_name)
  setStaticUserProperty_('oauth_token'+signature, oauth_token)
  setStaticUserProperty_('oauth_token_secret'+signature, oauth_token_secret)
  return HtmlService.createTemplateFromFile('4_auth_success')
                  .evaluate()
                  .setTitle('Twitter Authorisation Complete')
                  .setSandboxMode(HtmlService.SandboxMode.IFRAME)
}

/**
* Set library user key/secret
*
* @param {object} formObject Key and secret from credenitals popup
*/
function setUserKeySecret(formObject){
  setStaticUserProperty_('consumerKey', formObject.consumerKey.trim());
  setStaticUserProperty_('consumerSecret', formObject.consumerSecret.trim());
  consumer.consumerKey = formObject.consumerKey;
  consumer.consumerSecret = formObject.consumerSecret;
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
* Disconnect user from Twitter.
*
*/
function disconnectTwitter(){
  deleteStaticUserProperty_('screen_name'+INITIALISED_SIG);
  deleteStaticUserProperty_('oauth_token'+INITIALISED_SIG);
  deleteStaticUserProperty_('oauth_token_secret'+INITIALISED_SIG);
  deleteStaticUserProperty_('consumerKey'+INITIALISED_SIG);
  deleteStaticUserProperty_('consumerSecret'+INITIALISED_SIG);
}

/**
* Show auth window (private).
*
* @param {Object} doctype Instigator service (DocumentApp || SpreadsheetApp etc)
* @param {string} stepTemplate The template file to render
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
    // if Google old Sheet fallback to UiApp
    switch(stepTemplate){
      case "1_cred_pop":
        doctype.getActiveSpreadsheet().show(cred_pop_old_());
        break;
    }
  }
}

/**
* Show the key/secret data entry form.
*
* @param {(DocumentApp|SpreadsheetApp)} doc The Document or Spreadsheet the library is being called from.
*/
function showTwitterKeySecret(doc){
   return showDialog_(doc, '1_cred_pop');
}

/**
* Show auth window for a DocumentApp.
* 
* @param {(DocumentApp|SpreadsheetApp)} doc The Document or Spreadsheet the library is being called from.
*/
function showTwitterLogin(doc){
  return showDialog_(doc, '2_start_auth');
}

/**
* Used as part of setup() to process form data
*/
function processForm(formObject) {
  setUserKeySecret(formObject);
  return showTwitterLogin(false);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}