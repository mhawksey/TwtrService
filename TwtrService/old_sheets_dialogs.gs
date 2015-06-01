/**
* Allows Key/Secret dialogs for old sheets.
*
*/
function cred_pop_old_(){
// modified from Twitter Approval Manager 
// http://code.google.com/googleapps/appsscript/articles/twitter_tutorial.html
  var app = UiApp.createApplication()
    .setHeight(H)
    .setWidth(W)
    .setTitle("Twitter Authorisation");
  app.setStyleAttribute("padding", "10px");
  app.setStyleAttribute("lineHeight", "18px");
  var liStyle = {"marginLeft": "30px", "textIndent": "-15px"};
  
  var dialogPanel = app.createFlowPanel().setWidth(W);
  dialogPanel.setId("infoArea");
  app.create
  var label1 = app.createLabel("To collect data from Twitter you need to register a new application. Registering your application and connecting should be a one time only task.").setStyleAttribute("marginBottom", "13px");
  var label2 = app.createLabel("Steps").setStyleAttributes({"fontWeight": "bold", "marginBottom": "13px"});
  //var label3 = app.createLabel("1. ").setStyleAttributes(liStyle);
  var label3_1 = app.createInlineLabel("1. Register for an API key with Twitter at ").setStyleAttribute("marginLeft","15px");
  var label3_2 = app.createAnchor("https://dev.twitter.com/apps/new", "https://dev.twitter.com/apps/new");
  var label3_3 = app.createLabel(" (if you've already registered for a TAGS sheet you can reuse your existing API Key and Secret).").setStyleAttribute("marginLeft","30px");
  var label3_4 = app.createHTML("◇ Name, description and website can be anything you like<br/>◇ <strong>Important</strong> Include the Callback URL https://script.google.com/macros/").setStyleAttribute("marginLeft","45px");
  var label4 = app.createLabel("2. Read the 'Developer Rules of the Road' before clicking 'Create your Twitter application").setStyleAttributes(liStyle);
  var label5 = app.createLabel("3. Enter your Twitter application API key and secret in the form below:").setStyleAttributes(liStyle);

  dialogPanel.add(label1);
  dialogPanel.add(label2);
  dialogPanel.add(label3_1);
  dialogPanel.add(label3_2);
  dialogPanel.add(label3_3);
  dialogPanel.add(label3_4);
  dialogPanel.add(label4);
  dialogPanel.add(label5);

  var consumerKeyLabel = app.createLabel("API Key").setStyleAttribute("marginTop", "13px");
  var consumerKey = app.createTextBox();
  consumerKey.setName("consumerKey");
  consumerKey.setWidth("90%");
  consumerKey.setText(getUserKey());
  var consumerSecretLabel = app.createLabel("API Secret").setStyleAttribute("marginTop", "13px");
  var consumerSecret = app.createTextBox();
  consumerSecret.setName("consumerSecret");
  consumerSecret.setWidth("90%");
  consumerSecret.setText(getUserSecret());
  
  var saveHandler = app.createServerClickHandler("saveCredentials");
  var saveButton = app.createButton("Next", saveHandler)
  saveButton.setStyleAttributes({"backgroundImage": "-webkit-linear-gradient(top, #4D90FE, #4787ED)",
                                 "borderColor": "#3079ED",
                                 "borderRadius": "2px",
                                 "backgroundColor": "#4787ED",
                                 "padding": "0 8px",
                                 "height": "29px",
                                 "fontSize": "11px",
                                 "fontWeight": "bold",
                                 "color": "#ffffff",
                                 "width": "72px"});
  
  dialogPanel.add(consumerKeyLabel);
  dialogPanel.add(consumerKey);
  dialogPanel.add(consumerSecretLabel);
  dialogPanel.add(consumerSecret);

  // Ensure that all form fields get sent along to the handler
  saveHandler.addCallbackElement(dialogPanel);

  dialogPanel.add(saveButton);
  app.add(dialogPanel);
  
  return app;
};

/**
* [DO NOT USE] This is a save handler for old sheets 
* 
*/
function saveCredentials(e) {
  var formObject = e.parameter;
  setUserKeySecret(formObject);
  var app = UiApp.getActiveApplication();
  var dialogPanel = app.getElementById("infoArea");
  dialogPanel.clear();
    
  var label1_1 = app.createInlineLabel("The next step is to connect to Twitter. You can remove this authorization at anytime using your Twitter Appllication Settings ");
  var label1_2 = app.createAnchor("https://twitter.com/settings/applications", "https://twitter.com/settings/applications");
  var label2 = app.createHTML("<strong>Note</strong>: You only need to do this once for all your Google Drive documents that connect to Twitter using this service").setStyleAttribute("margin", "13px 0");
  var button = app.createAnchor("Next", true, SERVICE_URL);
  button.setStyleAttributes({"backgroundImage": "-webkit-linear-gradient(top, #4D90FE, #4787ED)",
                                 "borderColor": "#3079ED",
                                 "borderRadius": "2px",
                                 "backgroundColor": "#4787ED",
                                 "padding": "8px 20px",
                                 "textDecoration": "none",
                                 "height": "29px",
                                 "fontSize": "11px",
                                 "fontWeight": "bold",
                                 "color": "#ffffff",
                                 "width": "72px"});
  var closeHandler = app.createServerClickHandler("closeDialog");
  button.addClickHandler(closeHandler);
  
  dialogPanel.add(label1_1);
  dialogPanel.add(label1_2);
  dialogPanel.add(label2);
  dialogPanel.add(button);
  return app;
}

/**
* [DO NOT USE] This is a close handler for old sheets 
* 
*/
function closeDialog(){
  var app = UiApp.getActiveApplication();
  app.close();
  return app;
}
