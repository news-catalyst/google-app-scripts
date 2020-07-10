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
  var metadata = setArticleMeta();
  Logger.log("Showing sidebar after requesting article metadata");
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

function storeLatestVersionPublished(isLatestVersionPublished) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.setProperty('LATEST_VERSION_PUBLISHED', isLatestVersionPublished);
}

function getLatestVersionPublished() {
  var documentProperties = PropertiesService.getDocumentProperties();
  var isLatestVersionPublished = documentProperties.getProperty('LATEST_VERSION_PUBLISHED');
  return isLatestVersionPublished;
}

function getArticleMeta() {
  var articleID = getArticleID();
  var isLatestVersionPublished = getLatestVersionPublished();
  var headline = getHeadline();
  var byline = getByline();

  return {
    articleID: articleID,
    isPublished: isLatestVersionPublished,
    headline: headline,
    byline: byline
  }
}

/**
 * Retrieves the ID of the document's locale from local doc storage
 */
function getLocaleID() {
  return getValue('LOCALE_ID');
}

/**
 * Stores the ID of the locale in the local doc storage
 * @param localeID webiny ID for the doc's locale
 */
function storeLocaleID(localeID) {
  storeValue("LOCALE_ID", localeID);
}

function getHeadline() {
  return getValue('ARTICLE_HEADLINE');
}

function storeHeadline(headline) {
  storeValue("ARTICLE_HEADLINE", headline)
}

function getByline() {
  return getValue('ARTICLE_BYLINE');
}

function storeByline(byline) {
  storeValue("ARTICLE_BYLINE", byline)
}

function getHeadline() {
  return getValue('ARTICLE_HEADLINE');
}

function storeHeadline(headline) {
  storeValue("ARTICLE_HEADLINE", headline)
}

function getByline() {
  return getValue('ARTICLE_BYLINE');
}

function storeByline(byline) {
  storeValue("ARTICLE_BYLINE", byline)
}

/**
. * Gets the current document's contents
. */
function getCurrentDocContents() {
  var title = getHeadline();
  var formattedElements = formatElements();

  var articleID = getArticleID();

  // first save the latest article content - either create a new article, or create a new revision on an existing article
  var webinyResponse;
  // if we already have an articleID and latest version info, we need to create a new version of the article
  if (articleID !== null) {
    // webinyResponse = updateArticle(articleID, title, formattedElements);
    webinyResponse = createArticleFrom(articleID, title, formattedElements);
  // otherwise, we create a new article
  } else {
    webinyResponse = createArticle(title, formattedElements);
  }

  var responseText = webinyResponse.getContentText();
  var responseData = JSON.parse(responseText);
  var articleID = responseData.data.content.data.id;
  storeArticleID(articleID);
  Logger.log('stored article ID: ', articleID);

  var webinyResponseCode = webinyResponse.getResponseCode();
  var responseText;
  if (webinyResponseCode === 200) {
    responseText = 'Successfully stored article in webiny.';
  } else {
    responseText = 'Webiny responded with code ' + webinyResponseCode;
  }
  // publish
  var publishResponse = publishArticle();
  Logger.log("response from publishArticle: ", publishResponse);

  responseText += "<br>" + publishResponse;

  // update published flag and latest version ID
  setArticleMeta();

  return responseText;
}

/**
 * Gets the title of the article
 */
function getDocumentName() {
  var headline = DocumentApp.getActiveDocument().getName();
  return headline;
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
    imgProps.alt = o.title;
    if (o.hasOwnProperty('imageProperties')) {
      imgProps.url = o.imageProperties.contentUri;
    }
    ar.push(imgProps);
    return ar;
  },
  []);

  return inlineObjects;
}

function getElements() {
  var documentID = DocumentApp.getActiveDocument().getId();
  var document = Docs.Documents.get(documentID);
  var elements = document.body.content;
  var inlineObjects = document.inlineObjects;

  var listInfo = {};
  var listItems = DocumentApp.getActiveDocument().getListItems();
  listItems.forEach(li => {
    var id = li.getListId();
    var glyphType = li.getGlyphType();
    listInfo[id] = glyphType;
  })

  var orderedElements = [];
  elements.forEach(element => {
    Logger.log(element);
    if (element.paragraph && element.paragraph.elements) {
      var eleData = {
        children: [],
        link: null,
        type: null,
        index: element.endIndex
      };

      // handle list items
      if (element.paragraph.bullet) {
        eleData.type = "list";
        eleData.index = element.endIndex;
        var nestingLevel = element.paragraph.bullet.nestingLevel;
        if (nestingLevel === null || typeof nestingLevel === "undefined") {
          nestingLevel = 0;
        }
        // Find existing element with the same list ID
        var listID = element.paragraph.bullet.listId;

        var findListElement = (element) => element.type === "list" && element.listId === listID
        var listElementIndex = orderedElements.findIndex(findListElement);
        // don't create a new element for an existing list
        // just append this element's text to the exist list's children
        if (listElementIndex > 0) {
          var listElement = orderedElements[listElementIndex];
          element.paragraph.elements.forEach(subElement => {
            // append list items to the main list element's children
            listElement.children.push({
              content: cleanContent(subElement.textRun.content),
              index: subElement.endIndex,
              nestingLevel: nestingLevel,
              style: cleanStyle(subElement.textRun.textStyle)
            })
          });
          orderedElements[listElementIndex] = listElement;
        } else {
          // make a new list element
          if (listInfo[listID]) {
            eleData.listType = listInfo[listID];
          } else {
            eleData.listType = "BULLET";
          }
          eleData.type = "list";
          eleData.listId = listID;
          element.paragraph.elements.forEach(subElement => {
            // append list items to the main list element's children
            eleData.children.push({
              content: cleanContent(subElement.textRun.content),
              index: subElement.endIndex,
              nestingLevel: nestingLevel,
              style: cleanStyle(subElement.textRun.textStyle)
            })
          });
          orderedElements.push(eleData);
        }
      }

      // filter out blank subelements
      var subElements = element.paragraph.elements.filter(subElement => subElement.textRun && subElement.textRun.content.trim().length > 0)
      // try to find an embeddable link: url on its own line matching one of a set of hosts (twitter, youtube, etc)
      if (subElements.length === 1) {
        var foundLink = subElements.find(subElement => subElement.textRun.textStyle.hasOwnProperty('link'))
        if (foundLink) { 
          var linkUrl = foundLink.textRun.textStyle.link.url;
          Logger.log("found a link: ", linkUrl)
          var embeddableUrl = (/twitter\.com|youtube\.com|youtu\.be|google\.com|imgur.com|twitch\.tv|vimeo\.com|mixcloud\.com|instagram\.com|facebook\.com|dailymotion\.com/i).test(linkUrl);
          if (embeddableUrl) {
            Logger.log("found embeddableUrl: ", linkUrl);
            eleData.type = "embed";
            eleData.link = linkUrl;
            orderedElements.push(eleData);
          } else {
            Logger.log("url not embeddable: ", linkUrl);
          }
        } else {
          Logger.log("failed to find a link in element child", subElements[0])
        }
      } 

      element.paragraph.elements.forEach(subElement => {
        // skip lists and embed links - we already processed these above
        if (eleData.type !== "list" && eleData.type !== "embed") {
          // found a paragraph of text
          if (subElement.textRun && subElement.textRun.content && subElement.textRun.content.trim().length > 0) {
            eleData.type = "text";

            if (element.paragraph.paragraphStyle.namedStyleType) {
              eleData.style = element.paragraph.paragraphStyle.namedStyleType;
            }
            var childElement = {
              index: subElement.endIndex,
            }
            childElement.style = cleanStyle(subElement.textRun.textStyle);

            if (subElement.textRun.textStyle && subElement.textRun.textStyle.link) {
              childElement.link = subElement.textRun.textStyle.link.url;
            }
            childElement.content = cleanContent(subElement.textRun.content);

            eleData.children.push(childElement);
          }

          // found an image
          if ( subElement.inlineObjectElement && subElement.inlineObjectElement.inlineObjectId) {
            eleData.type = "image";
            var imageID = subElement.inlineObjectElement.inlineObjectId;
            var fullImageData = inlineObjects[imageID];
            if (fullImageData) {
              var childImage = {
                index: subElement.endIndex,
                height: fullImageData.inlineObjectProperties.embeddedObject.size.height.magnitude,
                width: fullImageData.inlineObjectProperties.embeddedObject.size.width.magnitude,
                imageId: subElement.inlineObjectElement.inlineObjectId,
                imageUrl: fullImageData.inlineObjectProperties.embeddedObject.imageProperties.contentUri,
                imageAlt: cleanContent(fullImageData.inlineObjectProperties.embeddedObject.title)
              };
              eleData.children.push(childImage);
            }
          }
        }
      })
      // skip any blank elements, embeds and lists because they've already been handled above
      if (eleData.type !== null && eleData.type !== "list" && eleData.type !== "embed") {
        orderedElements.push(eleData);
      }
    }
  });

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
      type: element.type,
      link: element.link,
      listType: element.listType
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
      // Found a paragraph, append to the list
      var paragraphText = par.getText();
      paragraphs.push(paragraphText);
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
 * Creates a new revision of the article
 * @param versionID
 * @param title 
 * @param elements 
 */
function createArticleFrom(versionID, title, elements) {
  Logger.log("createArticleFrom versionID: ", versionID);

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating article: unable to find a default locale';
    }
  }

  var byline = getByline();

  var formData = {
    query: `mutation CreateBasicArticleFrom($revision: ID!, $data: BasicArticleInput) {
      content: createBasicArticleFrom(revision: $revision, data: $data) {
        data {
          id
          savedOn
          meta {
            published
            latestVersion
            revisions {
              id
              meta {
                latestVersion
                published
              }
            }
            version
            locked
            parent
            status
          }
        }
        error {
          message
          code
          data
        }
      }
    }`,
    variables: {
      revision: versionID,
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
              value: byline,
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
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  var latestVersionID = responseData.data.content.data.id;
  Logger.log("Storing latest version of articleID: ", latestVersionID);
  storeArticleID(latestVersionID);
  return response;
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

  var byline = getByline();

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
              value: byline,
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

  var byline = getByline();

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
              value: byline,
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

/**
 * Publishes the article
 */
function publishArticle() {
  var versionID = getArticleID();
  Logger.log("publishing article versionID: ", versionID);

  var formData = {
    query: `mutation PublishBasicArticle($revision: ID!) {
      content: publishBasicArticle(revision: $revision) {
        data {
          id
          meta {
            published
            latestVersion
            version
            locked
            parent
            status
            revisions {
              id
              meta {
                latestVersion
                published
                version
                locked
                parent
                status
              }
            }
          }
        }
        error {
          message
          code
          data
        }
      }
    }`,
    variables: {
      revision: versionID,
    }
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
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log(responseData);

  // TODO update latestVersionPublished flag

  if (responseData && responseData.data.content.data !== null) {
    return "Published article at revision " + versionID;
  } else {
    return responseData.data.content.error;
  }
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

function cleanStyle(incomingStyle) {
  var cleanedStyle = {
    underline: incomingStyle.underline,
    bold: incomingStyle.bold,
    italic: incomingStyle.italic
  }
  return cleanedStyle;
}

function setArticleMeta() {
  var articleID = getArticleID();

  // prefer custom headline (set in sidebar form) but fallback to document name
  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var formData = {
    query: `query getBasicArticle($id: ID!) {
      content: getBasicArticle(where: {id: $id}) {
        data {
          id
          savedOn
          meta {
            published
            version
            locked
            parent
            status
            latestVersion
            revisions {
              id
              meta {
                latestVersion
                published
              }
            }
          }
        }
        error {
          message
          code
          data
        }
      }
    }`,
    variables: {
      id: articleID,
    }
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
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log(responseData);

  var articleID = responseData.data.content.data.id;
  var latestVersionID = null;
  var latestVersionPublished;
  var revisions = responseData.data.content.data.meta.revisions;
  Logger.log("revisions: ", revisions);
  revisions.forEach(revision => {
    if (revision.meta.latestVersion) {
      latestVersionID = revision.id;
      latestVersionPublished = revision.meta.published;
    }
  })

  // the ID of the most recent revision of the article should now be treated as its articleID
  // save this in the document properties store
  if (latestVersionID !== null) {
    storeArticleID(latestVersionID);
    storeLatestVersionPublished(latestVersionPublished);
  }

  return responseData;
}

function cleanContent(content) {
  return content.trim();
}

function getValue(key) {
  var documentProperties = PropertiesService.getDocumentProperties();
  var value = documentProperties.getProperty(key);
  return value;
}

function storeValue(key, value) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.setProperty(key, value);
}

function processForm(formObject) {
  Logger.log("processForm: ", formObject);

  var headline = formObject["article-headline"];
  storeHeadline(headline);

  var byline = formObject["article-byline"];
  storeByline(byline);

  return "Saved article headline and byline."
}
