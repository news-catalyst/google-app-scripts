// TODO: add form fields to the sidebar requesting these values
var ACCESS_TOKEN = "32671a3e2a109127e05a666ab469d2901d3999b8977af6a2";
var PERSONAL_ACCESS_TOKEN = "40ae4d0bed27eeae5fbbe761972c746e3e19485e903b7527"
var CONTENT_API = "https://d3a91xrcpp69ev.cloudfront.net/cms/manage/production"
var GRAPHQL_API = "https://d3a91xrcpp69ev.cloudfront.net/graphql"

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
 * Retrieves the ID of the article from the local document storage
 */
function getArticleID() {
  var documentProperties = PropertiesService.getDocumentProperties();
  var storedArticleID = documentProperties.getProperty('ARTICLE_ID');
  return storedArticleID;
}

/**
 * Stores the ID of the article in the local document storage
 */
function storeArticleID(articleID) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.setProperty('ARTICLE_ID', articleID);
}

/**
 * Retrieves the ID of the document's locale from local doc storage
 */
function getLocaleID() {
  var documentProperties = PropertiesService.getDocumentProperties();
  var storedLocaleID = documentProperties.getProperty('LOCALE_ID');
  return storedLocaleID;
}

/**
 * Stores the ID of the locale in the local doc storage
 * @param localeID webiny ID for the doc's locale
 */
function storeLocaleID(localeID) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.setProperty('LOCALE_ID', localeID);
}

/**
. * Gets the current document's contents
. */
function getCurrentDocContents() {
  var title = getHeadline();
  var formattedElements = formatElements();

  var articleID = getArticleID();

  var webinyResponse;
  if (articleID !== null) {
    webinyResponse = updateArticle(articleID, title, formattedElements);
  } else {
    webinyResponse = createArticle(title, formattedElements);
  }

  var responseText = webinyResponse.getContentText();
  var responseData = JSON.parse(responseText);
  var articleID = responseData.data.content.data.id;
  storeArticleID(articleID);
  Logger.log('new article ID: ', articleID);

  var webinyResponseCode = webinyResponse.getResponseCode();
  var responseText;
  if (webinyResponseCode === 200) {
    responseText = 'Successfully stored article in webiny.';
  } else {
    responseText = 'Webiny responded with code ' + webinyResponseCode;
  }
  return responseText;
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
  while ((searchResult = body.findElement(searchType, searchResult))) {
    var par = searchResult.getElement().asParagraph();
    if (par.getHeading() == searchHeading) {
      // Found one, update and stop.
      title = par.getText();
      Logger.log('Found title: ', title);
      return title;
    }
  }
  return title;
}

function getImages() {
  var documentID = DocumentApp.getActiveDocument().getId();
  var document = Docs.Documents.get(documentID);

  var inlineObjects = Object.keys(document.inlineObjects).reduce(function (
    ar,
    e,
    i
  ) {
    var o = document.inlineObjects[e].inlineObjectProperties.embeddedObject;
    var imgProps = {};
    Logger.log("title: ", o.title, " and description: ", o.description);
    imgProps.alt = o.title;
    if (o.hasOwnProperty('imageProperties')) {
      imgProps.url = o.imageProperties.contentUri;
    }
    ar.push(imgProps);
    return ar;
  },
  []);

  Logger.log(inlineObjects)
  return inlineObjects;
}

function getElements() {
  var documentID = DocumentApp.getActiveDocument().getId();
  var document = Docs.Documents.get(documentID);
  var elements = document.body.content;
  var inlineObjects = document.inlineObjects;

  var orderedElements = [];
  elements.forEach(element => {
    Logger.log(element);
    if (element.paragraph && element.paragraph.elements) {
      var eleData = {
        children: [],
        type: null,
        index: element.endIndex
      };
      element.paragraph.elements.forEach(subElement => {
        // found a paragraph of text
        if (subElement.textRun && subElement.textRun.content && subElement.textRun.content.trim().length > 0) {
          eleData.type = "text";

          if (element.paragraph.paragraphStyle.namedStyleType) {
            eleData.style = element.paragraph.paragraphStyle.namedStyleType;
          }
          var childElement = {
            index: subElement.endIndex,
          }
          var style = subElement.textRun.textStyle;
          var cleanedStyle = {
            underline: style.underline,
            bold: style.bold,
            italic: style.italic
          }
          childElement.style = cleanedStyle;

          if (style && style.link) {
            childElement.link = style.link.url;
          }
          childElement.content = subElement.textRun.content;

          eleData.children.push(childElement);
        }
        // found an image
        if ( subElement.inlineObjectElement && subElement.inlineObjectElement.inlineObjectId) {
          eleData.type = "image";
          var imageID = subElement.inlineObjectElement.inlineObjectId;
          Logger.log("imageId: ", imageID);
          var fullImageData = inlineObjects[imageID];
          Logger.log("fullImageData: ", fullImageData);
          if (fullImageData) {
            var childImage = {
              index: subElement.endIndex,
              height: fullImageData.inlineObjectProperties.embeddedObject.size.height.magnitude,
              width: fullImageData.inlineObjectProperties.embeddedObject.size.width.magnitude,
              imageId: subElement.inlineObjectElement.inlineObjectId,
              imageUrl: fullImageData.inlineObjectProperties.embeddedObject.imageProperties.contentUri,
              imageAlt: fullImageData.inlineObjectProperties.embeddedObject.title
            };
            Logger.log("fullImageData: ", childImage);
            eleData.children.push(childImage);
          }
        }
      })
      // skip any blank elements
      if (eleData.type !== null) {
        orderedElements.push(eleData);
      }
    }
  });

  Logger.log(orderedElements);
  return orderedElements;

}

function formatElements() {
  var elements = getElements();

  var formattedElements = [];
  elements.sort(function (a, b) {
    if (a.index > b.index) {
      return 1;
    } else {
      return -1;
    }
  }).forEach(element => {
    var formattedElement = {
      type: element.type
    };
    formattedElement.children = element.children;
    formattedElements.push(formattedElement);
  })
  return formattedElements;
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
  while ((searchResult = body.findElement(searchType, searchResult))) {
    var ele = searchResult.getElement();
    var par = ele.asParagraph();

    if (par.getHeading() == searchHeading) {
      Logger.log("Found a normal paragraph: ", par);
      // Found a paragraph, append to the list
      var paragraphText = par.getText();
      paragraphs.push(paragraphText);
    } else {
      Logger.log("Found a not normal paragraph: ", par);
    }
  }
  return paragraphs;
}

/**
 * Formats an array of images found in the doc into JSON to store in Webiny 
 *  as part of the article body.
 * @param images an array of image data
 * 
 */
function formatImages(images) {
  var formattedImages = [];
  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    formattedImages.push({
      type: 'image',
      url: img.url,
      alt: img.alt
    });
  }
  return formattedImages;
}

/**
 * 
 * Formats paragraphs into JSON for storing in the webiny article body
 * @param paragraphs an array of paragraph data
 */
function formatParagraphs(paragraphs) {
  var formattedParagraphs = [];
  for (var i = 0; i < paragraphs.length; i++) {
    var p = paragraphs[i];
    Logger.log('now formatting paragraph: ', p);
    formattedParagraphs.push({
      type: 'paragraph',
      children: [
        {
          text: p,
        },
      ],
    });
  }
  return formattedParagraphs;
}

/**
. * Posts document contents to graphql, creating a new article
. */
function createArticle(title, elements) {

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating article: unable to find a default locale';
    }
  }

  var formData = {
    query:
      'mutation CreateBasicArticle($data: BasicArticleInput!) {\n  content: createBasicArticle(data: $data) {\n    data {\n      id\n      headline {\n        values {\n          value\n          locale\n        }\n      }\n      body {\n        values {\n          value\n          locale\n        }\n      }\n      byline {\n        values {\n          value\n          locale\n        }\n      }\n    }\n    error {\n      message\n      code\n      data\n    }\n  }\n}',
    variables: {
      data: {
        headline: {
          values: [
            {
              locale: localeID,
              value: title,
            },
          ],
        },
        body: {
          values: [
            {
              locale: localeID,
              value: elements,
            },
          ],
        },
        byline: {
          values: [
            {
              locale: localeID,
              value: "Jacqui Lough",
            },
          ],
        },
      },
    },
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  Logger.log(response.getContentText());
  return response;
}

/*
 * Updates an article in webiny
 */
function updateArticle(id, title, elements) {

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating article: unable to find a default locale';
    }
  }

  var formData = {
    query: `mutation UpdateBasicArticle($id: ID!, $data: BasicArticleInput!) {
      content: updateBasicArticle(where: { id: $id }, data: $data) {
       data {
        id
        headline {
          values {
            value
            locale
          }
        }
        body {
          values {
            value
            locale
          }
        }
        byline {
          values {
            value
            locale
          }
        }
        savedOn
      }
      error {
        message
        code
        data
      }
    }
  }`,
    variables: {
      id: id,
      data: {
        headline: {
          values: [
            {
              locale: localeID,
              value: title,
            },
          ],
        },
        body: {
          values: [
            {
              locale: localeID,
              value: elements,
            },
          ],
        },
        byline: {
          values: [
            {
              locale: localeID,
              value: "Jacqui Lough",
            },
          ],
        },
      },
    },
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  Logger.log(options);

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  Logger.log(response.getContentText());
  return response;
}

function getLocales() {
  query = `{
    i18n {
      listI18NLocales {
        data {
          id
          code
          default
        }

      }
    }
  }`;

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      authorization:
        PERSONAL_ACCESS_TOKEN,
    },
    payload: JSON.stringify({ query: query }),
  };

  var response = UrlFetchApp.fetch(
    GRAPHQL_API,
    options
  );
  var responseText = response.getContentText();
  Logger.log(responseText);
  var responseData = JSON.parse(responseText);

  var localeData = responseData.data.i18n.listI18NLocales.data;
  return localeData;
}

function setDefaultLocale(locales) {
  var localeID = null;
  for (var i = 0; i < locales.length; i++) {
    if (locales[i].default) {
      localeID = locales[i].id;
    }
  }
  if (localeID !== null) {
    storeLocaleID(localeID);
  }
  return 'Stored localeID as ' + localeID;
}
