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

// Structure influenced by Abraham Williams TwitterOAuth https://github.com/abraham/twitteroauth 

/*****
*  CORE get/post handlers
******/

/**
* GET wrapper for request to the Twitter REST API. For full documentation of API method endpoints and parameters see https://dev.twitter.com/rest/public. For example to get last 100 tweets containing 'Google Apps Script': var data = TwtrService.get('search/tweets', {q: 'Google Apps Script', count: 100});
*
* @param {string} url Twitter REST API resource url. This can be either long form e.g. https://api.twitter.com/1.1/search/tweets.json or abbreviated e.g. search/tweets
* @param {Object} parameters additional API parameters as detailed in the Twitter REST API documentation e.g. for search results a search string and count is specified by {q: 'Google Apps Script', count: 100}.
* @return {Object} API response in JSON format.
*/
function get(url, parameters) {
  var url = buildUrl_(url, parameters);
  return request_(url, 'GET');
}

/**
* POST wrapper for request to the Twitter REST API. For full documentation of API method endpoints and parameters see https://dev.twitter.com/rest/public.
*
* @param {string} url Twitter REST API resource url. This can be either long form e.g. https://api.twitter.com/1.1/search/tweets.json or abbreviated e.g. search/tweets
* @param {Object} parameters additional API parameters as detailed in the Twitter REST API documentation e.g. for search results a search string and count is specified by {q: 'Google Apps Script', count: 100}.
* @return {Object} API response in JSON format.
*/
function post(url, parameters) {
  var url = buildUrl_(url);
  return request_(url, 'POST', parameters);
}

function upload(url, parameters) {
  url = buildUrl_(UPLOAD_HOST+url);
  return request_(url, 'POST', parameters);
}

/**
* Handle API request to Twitter.
*
* @param {string} url api endpoint 
* @param {string} method. 
* @param {Object}  additional api parameters.
* @return {Object} response.
*/
function request_(url, method, optParam){
  var param = optParam || {};
  var urlFetchOptions = {};
  if (method !== 'GET'){
    var urlFetchOptions = {
      "method" : method,
      "payload" : param,
    };
  }

  try {
    var twitterService = getTwitterService();
    var f = twitterService.fetch(url, urlFetchOptions);
    if (f.getResponseCode() === 429){
      return Browser.msgBox("Twitter rate limit exceeded");
    }
    return JSON.parse(f.getContentText());
  } catch(e) {
    return e;
  }
}

/**
 * Convert object array into param array list.
 * 
 * @param {Object} param to array pair.
 * @return {Array} out array pair.
 */
function getParamArray_(param){
  var out = [];
  for (i in param){
    out.push(i,param[i]);
  }
  return out;
}

/**
 * Build a querystring from a object http://stackoverflow.com/a/5340658/1027723
 *
 * @param {string}  url base.
 * @param {Object} objects to add to string.
 * @return {string} url.
 */
function buildUrl_(url, parameters){
  if (url.indexOf(FORMAT) !== 0) {
    url = url+'.'+FORMAT;
  }
  if (url.indexOf('https://') !== 0 && url.indexOf('http://') !== 0) {
    url = HOST+url;
  }
  var qs = "";
  for(var key in parameters) {
    var value = parameters[key];
    qs += encodeURIComponent(key) + "=" + encodeURL_(value) + "&";
  }
  if (qs.length > 0){
    qs = qs.substring(0, qs.length-1); //chop off last "&"
    url = url + "?" + qs;
  }
  return url;
}

/**
 * Encode string for RFC 3986 escaping.
 * https://code.google.com/p/google-apps-script-issues/issues/detail?id=3046
 * suggested by Sergii Kauk https://plus.google.com/u/0/+AmitAgarwal/posts/FSuCNdh7jJ1
 *
 * @param {string} string to encode.
 * @return {string} encoded string.
 */
function encodeURL_(string){
  return encodeURIComponent(string).replace(/!|\*|\(|\)|'/g, function(m){return "%"+m.charCodeAt(0).toString(16)});
}
