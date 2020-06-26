/**
 * The event handler triggered when installing the add-on.
 * @param {Event} e The onInstall event.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * The event handler triggered when opening the document.
 * @param {Event} e The onOpen event.
 * 
 * This adds a "Webiny" menu option.
 */
function onOpen() {
  DocumentApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
      .createMenu('Webiny')
      .addItem('Show sidebar', 'showSidebar')
      .addToUi();
}

/**
 * Displays a sidebar with Webiny integration stuff TBD
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Page')
      .setTitle('Webiny Integration')
      .setWidth(300);
  DocumentApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
      .showSidebar(html);
}

/**
. * Gets the current document's contents
. */
function getCurrentDocContents() {
  Logger.log("getCurrentDocContents called");
  var body = DocumentApp.getActiveDocument().getBody().getText();
  Logger.log(body);
  
  var title = getHeadline();
  Logger.log("getCurrentDocContents title: ", title);
  
  var paragraphs = getBody();
  Logger.log("getCurrentDocContents paragraph count: ", paragraphs.length);
  postToWebiny(title, paragraphs);
  
  return body;
}

/**
  * Gets the title of the article
  */
function getHeadline() {
  // Get the body section of the active document.
  var body = DocumentApp.getActiveDocument().getBody();

  // Define the search parameters.
  var searchType = DocumentApp.ElementType.PARAGRAPH;
  var searchHeading = DocumentApp.ParagraphHeading.TITLE;
  var searchResult = null;

  var title = null;
  
  // Search until the title is found.
  while (searchResult = body.findElement(searchType, searchResult)) {
    var par = searchResult.getElement().asParagraph();
    if (par.getHeading() == searchHeading) {
      // Found one, update and stop.
      title = par.getText();
      Logger.log("Found title: ", title);
      return title;
    }
  }
  return title;
}

/**
  * Gets the body (regular paragraphs) of the article
  */
function getBody() {
  // Get the contents of the active document.
  var body = DocumentApp.getActiveDocument().getBody();

  // Define the search parameters.
  var searchType = DocumentApp.ElementType.PARAGRAPH;
  var searchHeading = DocumentApp.ParagraphHeading.NORMAL;
  var searchResult = null;

  var paragraphs = [];
  
  // Search until all regular paragraphs are found.
  while (searchResult = body.findElement(searchType, searchResult)) {
    var par = searchResult.getElement().asParagraph();
    if (par.getHeading() == searchHeading) {
      // Found a paragraph, append to the list
      var paragraphText = par.getText();
      Logger.log("Found paragraph: ", paragraphText);
      paragraphs.push(paragraphText);
      Logger.log("in loop paragraphs: ", paragraphs);
    }
  }
  Logger.log("Total paragraphs found: ", paragraphs.length);
  return paragraphs;
}
/**
. * Posts document contents to graphql
. */
function postToWebiny(title, paragraphs) {
  Logger.log("postToWebiny title: ", title);
  
  var formattedParagraphs = [];
  for (var i=0; i<paragraphs.length; i++) {
    formattedParagraphs.push({
                "type":"paragraph",
                "children":[
                  {
                    "text": paragraphs[i]
                  }
                ]
              });
  }
  
  Logger.log("Formatted paragraphs: ", formattedParagraphs);
  
  var formData = {
    "query":"mutation CreateBasicArticle($data: BasicArticleInput!) {\n  content: createBasicArticle(data: $data) {\n    data {\n      id\n      headline {\n        values {\n          value\n          locale\n        }\n      }\n      body {\n        values {\n          value\n          locale\n        }\n      }\n      byline {\n        values {\n          value {\n            id\n          }\n          locale\n        }\n      }\n    }\n    error {\n      message\n      code\n      data\n    }\n  }\n}",
      "variables":{
           "data":{
             "headline":{
              "values":[
                {
                 "locale":"5ef27bfe217f170008aa3e1a",
                 "value": title
                }
               ]
      },
      "body":{
        "values":[
          {
            "locale":"5ef27bfe217f170008aa3e1a",
            "value": formattedParagraphs
          }
        ]
      },
      "byline":{
        "values":[
          {
            "locale":"5ef27bfe217f170008aa3e1a",
            "value":"5ef2803d2137510007a4cce9"
          }
        ]
      }
    }
  }
          };
  Logger.log(formData);
          var options = {
           'method' : 'post',
           'contentType': 'application/json',
            'headers': {
              'authorization': '36e16738a7c9207536cee611455f0f5edce360f8a9efe727'
            },             
           'payload' : JSON.stringify(formData)
          };
  
  Logger.log(options);
          
          var response = UrlFetchApp.fetch('https://dqntvb0f42uh4.cloudfront.net/cms/manage/production', options);
          Logger.log(response.getAllHeaders());
          Logger.log(response.getContentText());

}