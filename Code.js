/**
 * The event handler triggered when installing the add-on.
 * @param {Event} e The onInstall event.
 */
function onInstall(e) {
  Logger.log("onInstall running in authMode: ", e.authMode);
  onOpen(e);
}

/**
 * The event handler triggered when opening the document.
 * @param {Event} e The onOpen event.
 *
 * This adds a "Webiny" menu option.
 */
function onOpen(e) {
  Logger.log("onOpen running in authMode: ", e.authMode);
  // if (e && e.authMode === ScriptApp.AuthMode.NONE) {
  //   Logger.log("AuthMode is NONE")
  // } else {
  //   Logger.log("AuthMode is > NONE")
  // }

  // display sidebar
  DocumentApp.getUi()
    .createMenu('Webiny')
    .addItem('Show sidebar', 'showSidebar')
    .addToUi();
}

/**
 * Displays a sidebar with Webiny integration stuff TBD
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Page')
    .setTitle('CMS Integration')
    .setWidth(300);
  DocumentApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showSidebar(html);
}

//
// Utility functions
//

// get unique values from an array
// from https://stackoverflow.com/questions/1960473/get-all-unique-values-in-a-javascript-array-remove-duplicates?answertab=votes#tab-top
function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

// TODO Actual implementation TBD
function getOrganizationName() {
  return "News Catalyst"
}

/**
 * Gets the title of the article from the name of the Google Doc
 */
function getDocumentName() {
  var headline = DocumentApp.getActiveDocument().getName();
  return headline;
}

/*
.* for now this only trims whitespace, but stands to allow for any other text cleaning up we may need
.*/
function cleanContent(content) {
  if (content === null || typeof(content) === 'undefined') {
    return "";
  }
  return content.trim();
}

/*
.* condenses text style into one object allowing for bold, italic and underline
.* google docs style attribute often contains unrelated info, sometimes even the text content
.*/
function cleanStyle(incomingStyle) {
  var cleanedStyle = {
    underline: incomingStyle.underline,
    bold: incomingStyle.bold,
    italic: incomingStyle.italic
  }
  return cleanedStyle;
}

// Generates a slug for the article based on its headline
// NOTE: this was generating a slug with category + headline, but nextjs routing doesn't work with a slash in the slug :-/
function createArticleSlug(category, headline) {
  var hedSlug;
  if (headline !== null && headline.trim() !== "") {
    hedSlug = slugify(headline);
  }
  return hedSlug;
}

// Implementation from https://gist.github.com/codeguy/6684588
// takes a regular string and returns a slug
function slugify(value) {
  if (value === null || typeof(value) === 'undefined') {
    return "";
  }
  value = value.trim();
  value = value.toLowerCase();
  var from = "àáäâèéëêìíïîòóöôùúüûñç·/_,:;";
  var to   = "aaaaeeeeiiiioooouuuunc------";
  for (var i=0, l=from.length ; i<l ; i++) {
    value = value.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  }

  value = value.replace(/[^a-z0-9 -]/g, '') // remove invalid chars
      .replace(/\s+/g, '-') // collapse whitespace and replace by -
      .replace(/-+/g, '-'); // collapse dashes

  return value;
}

/*
.* This uploads an image in the Google Doc to S3
.* destination URL determined by: Organization Name, Article Title, and image ID
.*/
function uploadImageToS3(imageID, contentUri) {
  var scriptConfig = getScriptConfig();
  var AWS_ACCESS_KEY_ID = scriptConfig['AWS_ACCESS_KEY_ID'];
  var AWS_SECRET_KEY = scriptConfig['AWS_SECRET_KEY'];
  var AWS_BUCKET = scriptConfig['AWS_BUCKET'];

  var orgName = getOrganizationName();
  var orgNameSlug = slugify(orgName);
  var articleSlug = getArticleSlug();

  var objectName = "image" + imageID + ".png";

  // get the image data from google first
  var imageData = null;
  var res = UrlFetchApp.fetch(contentUri, {headers: {Authorization: "Bearer " + ScriptApp.getOAuthToken()}, muteHttpExceptions: true});
  if (res.getResponseCode() == 200) {
    imageData = res.getBlob(); //.setName("image1");
  } else {
    Logger.log("Failed to fetch image data for uri: ", contentUri);
    return null;
  }

  var destinationPath = orgNameSlug + "/" + articleSlug + "/" + objectName;
  var s3;

  try {
    s3 = getInstance(AWS_ACCESS_KEY_ID, AWS_SECRET_KEY);
  } catch (e) {
    Logger.log("Failed getting S3 instance: ", e)
  }

  try {
    s3.putObject(AWS_BUCKET, destinationPath, imageData, {logRequests:true});
  } catch (e) {
    Logger.log("Failed putting object: ", e)
  }
  var s3Url = "http://" + AWS_BUCKET + ".s3.amazonaws.com/" + destinationPath;
  return s3Url;
}

//
// Data storage functions
//

/*

.* Gets the script configuration, data available to all users and docs for this add-on
.*/
function getScriptConfig() {
  Logger.log("getScriptConfig START")
  var scriptProperties = PropertiesService.getScriptProperties();
  var data = scriptProperties.getProperties();
  Logger.log("getScriptConfig END")
  return data;
}

/*
.* Sets script-wide configuration
.*/
function setScriptConfig(data) {
  var scriptProperties = PropertiesService.getScriptProperties();
  for (var key in data) {
    scriptProperties.setProperty(key, data[key]);
  }
  return "Saved configuration.";
}

/*

.* general purpose function (called in the other data storage functions) to retrieve a value for a key
.*/
function getValue(key) {
  var documentProperties = PropertiesService.getDocumentProperties();
  var value = documentProperties.getProperty(key);
  return value;
}

function getValueJSON(key) {
  var valueString = getValue(key);
  var value = [];
  if (valueString && valueString !== null) {
    try {
      value = JSON.parse(valueString);
    } catch(e) {
      Logger.log("error parsing JSON: ", e)
      value = []
    }
  }
  return value;
}

/*
.* general purpose function (called in the other data storage functions) to set a value at a key
.*/
function storeValue(key, value) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.setProperty(key, value);
}

function storeValueJSON(key, value) {
  var valueString;
  try {
    valueString = JSON.stringify(value);
  } catch(e) {
    Logger.log("error stringify-ing data: ", e)
    valueString = JSON.stringify([]);
  }
  storeValue(key, valueString);
}

function deleteValue(key) {
  var documentProperties = PropertiesService.getDocumentProperties();
  documentProperties.deleteProperty(key);
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
 * Deletes the articleID
 * this is used when deleting the article from webiny
 */
function deleteArticleID() {
  deleteValue('ARTICLE_ID');
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

function getArticleSlug() {
  return getValue('ARTICLE_SLUG');
}  

function storeArticleSlug(slug) {
  storeValue("ARTICLE_SLUG", slug);
}

function getByline() {
  return getValue('ARTICLE_BYLINE');
}

function storeByline(byline) {
  storeValue("ARTICLE_BYLINE", byline);
}

function getHeadline() {
  return getValue('ARTICLE_HEADLINE');
}

function storeHeadline(headline) {
  storeValue("ARTICLE_HEADLINE", headline);
}

function getCategoryID() {
  return getValue('ARTICLE_CATEGORY_ID');
}

function storeCategoryID(categoryID) {
  storeValue("ARTICLE_CATEGORY_ID", categoryID)
}

function getCategories() {
  return getValueJSON('ALL_CATEGORIES');
}

function storeCategories(categories) {
  storeValueJSON('ALL_CATEGORIES', categories);
}

function getNameForCategoryID(categories, categoryID) {
  var result = categories.find( ({ id }) => id === categoryID );
  if (typeof(result) !== 'undefined') {
    return result.title.value;
  } else {
    return null;
  }
}

function storePublishingInfo(info) {
  storeValue("PUBLISHING_INFO", JSON.stringify(info));
}

function getPublishingInfo() {
  var publishingInfo = JSON.parse(getValue("PUBLISHING_INFO"));
  if (publishingInfo === null || typeof(publishingInfo) === 'undefined') {
    publishingInfo = {
      firstPublishedOn: "",
      lastPublishedOn: "",
      latestVersionID: "",
      isLatestVersionPublished: false,
      publishedOn: ""
    }
  }
  return publishingInfo;
}

/**
 * Deletes the article's publishing info
 * this is used when deleting the article from webiny
 */
function deletePublishingInfo() {
  deleteValue('PUBLISHING_INFO');
}

function getAuthors() {
  return getValueJSON('ARTICLE_AUTHORS');
}

function storeAuthors(authors) {
  if (authors === undefined) {
    Logger.log("storeAuthors called with undefined authors argument")
    return;
  }
  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow
  var storableAuthors = [];
  Logger.log("storeAuthors typeof authors: ", typeof(authors), authors);

  // the form in the sidebar sends a string with a single ID when one author is selected 
  // **argh**
  // this hack addresses that issue
  if (typeof(authors) === 'string') {
    authors = [authors];
  }

  // try to find id and name of each author to store full data
  authors.forEach(author => {
    var authorID;
    if (typeof(author) === 'object') {
      authorID = author.id;
    } else {
      authorID = author;
    }
    var result = allAuthors.find( ({ id }) => id === authorID );
    if (result !== undefined) {
      storableAuthors.push({
        id: result.id,
        newAuthor: false,
        name: result.name.value
      });
    }
  })

  storeValueJSON("ARTICLE_AUTHORS", storableAuthors);
}

function getAllAuthors() {
  return getValueJSON('ALL_AUTHORS');
}

function storeAllAuthors(authors) {
  return storeValueJSON('ALL_AUTHORS', authors);
}

function getTags() {
  return getValueJSON('ARTICLE_TAGS');
}

function getAllTags() {
  return getValueJSON('ALL_TAGS');
}

function storeAllTags(tags) {
  return storeValueJSON('ALL_TAGS', tags);
}

function storeTags(tags) {
  if (tags === undefined) {
    Logger.log("storeTags called with undefined tags argument")
    return;
  }
  var allTags = getAllTags(); // don't request from the DB again - too slow
  var storableTags = [];
  Logger.log("storeTags typeof tags: ", typeof(tags), tags);

  // the form in the sidebar sends a string with a single ID when one tag is selected 
  // **argh**
  // this hack addresses that issue
  if (typeof(tags) === 'string') {
    tags = [tags];
  }

  // try to find id and title of tag to store full data
  tags.forEach(tag => {
    var tagID;
    if (typeof(tag) === 'object') {
      tagID = tag.id;
    } else {
      tagID = tag;
    }
    var result = allTags.find( ({ id }) => id === tagID );
    if (result !== undefined) {
      storableTags.push({
        id: result.id,
        newTag: false,
        title: result.title.value
      });
    // treat this as a new tag
    } else {
      storableTags.push({
        id: null,
        newTag: true,
        title: tag
      });
    }
  })

  storeValueJSON("ARTICLE_TAGS", storableTags);
}

function getSEO() {
  seoValue = getValueJSON('ARTICLE_SEO');
  if (seoValue === null || seoValue.length <= 0) {
    Logger.log("seoValue is null or empty array")
    seoValue = {
      searchTitle: "",
      searchDescription: "",
      facebookTitle: "",
      facebookDescription: "",
      twitterTitle: "",
      twitterDescription: ""
    }
  } else {
    Logger.log("seoValue is: ", seoValue);
  }
  return seoValue;
}

function storeSEO(seoData) {
  storeValueJSON("ARTICLE_SEO", seoData);
}

//
// Functions for retrieving and formatting document contents
//

/*
. * Returns metadata about the article, including its id, whether it was published
. * headline and byline
. */
function getArticleMeta() {
  Logger.log("getArticleMeta START");
  var articleID = getArticleID();

  var publishingInfo = getPublishingInfo();
  Logger.log("publishingInfo: ", publishingInfo);

  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var byline;
  var allAuthors = loadAuthorsFromDB();
  storeAllAuthors(allAuthors);
  var articleAuthors = getAuthors();
  var authorSlugs = [];
  allAuthors.forEach(author => {
    const result = articleAuthors.find( ({ id }) => id === author.id );
    if (result !== undefined) {
      authorSlugs.push(author.slug.value);
    }
  });
  if (authorSlugs.length > 0) {
    byline = authorSlugs.join(' ');
    storeByline(byline);
  }

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    Logger.log("categories are blank: ", categories);
    categories = listCategories();
    Logger.log("loaded categories from webiny: ", categories);
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);

  var slug = createArticleSlug(categoryName, headline);
  storeArticleSlug(slug);

  // always load the latest tags from webiny to avoid issues being out of sync
  // FYI: I've run into problems when this isn't done (e.g. a dupe tag is created elsewhere, which could be likely when actual orgs use this
  // or more likely, the document storage in Google Docs gets some data weird with new vs existing tags)
  var allTags = loadTagsFromDB();
  storeAllTags(allTags);

  var articleTags = getTags();

  var seoData = getSEO();

  var scriptConfig = getScriptConfig();
  var previewUrl = scriptConfig['PREVIEW_URL']
  var previewSecret = scriptConfig['PREVIEW_SECRET'];
  var accessToken = scriptConfig['ACCESS_TOKEN'];
  var contentApi = scriptConfig['CONTENT_API'];
  var personalAccessToken = scriptConfig['PERSONAL_ACCESS_TOKEN'];
  var graphqlApi = scriptConfig['GRAPHQL_API'];
  var awsAccessKey = scriptConfig['AWS_ACCESS_KEY_ID'];
  var awsSecretKey = scriptConfig['AWS_SECRET_KEY'];
  var awsBucket = scriptConfig['AWS_BUCKET'];

  if (typeof(articleID) === "undefined" || articleID === null) {
    Logger.log("articleID is undefined, returning new doc state");

    return {
      awsAccessKey: awsAccessKey,
      awsSecretKey: awsSecretKey,
      awsBucket: awsBucket,
      graphqlApi: graphqlApi,
      personalAccessToken: personalAccessToken,
      accessToken: accessToken,
      contentApi: contentApi,
      previewUrl: previewUrl,
      previewSecret: previewSecret,
      articleID: null,
      headline: headline,
      byline: byline,
      publishingInfo: publishingInfo,
      allAuthors: allAuthors,
      articleAuthors: articleAuthors,
      allTags: allTags,
      articleTags: articleTags,
      categories: categories,
      categoryID: categoryID,
      categoryName: categoryName,
      slug: slug,
      seo: seoData
    }
  }

  var articleMetadata = {
    awsAccessKey: awsAccessKey,
    awsSecretKey: awsSecretKey,
    awsBucket: awsBucket,
    graphqlApi: graphqlApi,
    personalAccessToken: personalAccessToken,
    accessToken: accessToken,
    contentApi: contentApi,
    previewUrl: previewUrl,
    previewSecret: previewSecret,
    articleID: articleID,
    headline: headline,
    byline: byline,
    publishingInfo: publishingInfo,
    allAuthors: allAuthors,
    articleAuthors: articleAuthors,
    allTags: allTags,
    articleTags: articleTags,
    categories: categories,
    categoryID: categoryID,
    categoryName: categoryName,
    slug: slug,
    seo: seoData
  };

  Logger.log("getArticleMeta END");
  return articleMetadata;
}
/**
 * 
 * Saves the article as a draft, then publishes
 * @param {} formObject 
 */
function handlePublish(formObject) {
  Logger.log("Handling publish for formObject:", formObject);
  // save the article - pass publishFlag as true
  var message = getCurrentDocContents(formObject, true);
  Logger.log("message: ", message)

  return message;
}

/**
 * 
 * Saves the article as a draft, opens preview
 * @param {} formObject 
 */
function handlePreview(formObject) {
  Logger.log("Handling preview for formObject:", formObject);
  // save the article - pass publishFlag as false
  var message = getCurrentDocContents(formObject, false);
  Logger.log("message: ", message)

  // construct preview url
  var slug = getArticleSlug();

  var scriptConfig = getScriptConfig();
  var previewHost = scriptConfig['PREVIEW_URL'];
  var previewSecret = scriptConfig['PREVIEW_SECRET'];
  var fullPreviewUrl = previewHost + "?secret=" + previewSecret + "&slug=" + slug;

  // open preview url in new window
  message += "<br><a href='" + fullPreviewUrl + "' target='_blank'>Preview article in new window</a>"
  return message;
}

/**
. * Gets the current document's contents and
.  * posts them to webiny
. */
function getCurrentDocContents(formObject, publishFlag) {
  Logger.log("getCurrentDocContents: ", formObject);

  var propMessage = processForm(formObject);
  Logger.log(propMessage);

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

  var webinyResponseCode = webinyResponse.getResponseCode();
  var responseText;
  if (webinyResponseCode === 200) {
    responseText = 'Successfully stored article in webiny.';
  } else {
    responseText = 'Webiny responded with code ' + webinyResponseCode;
  }

  if (publishFlag) {
    Logger.log("Publishing article...")
    // publish
    var publishResponse = publishArticle();
    Logger.log("Done publishing article:", publishResponse);

    responseText += "<br>" + JSON.stringify(publishResponse);
  }

  // update published flag and latest version ID
  setArticleMeta();

  return responseText;
}


/*
.* Retrieves "elements" from the google doc - which are headings, images, paragraphs, lists
.* Preserves order, indicates that order with `index` attribute
.*/
function getElements() {
  var documentID = DocumentApp.getActiveDocument().getId();
  var document = Docs.Documents.get(documentID);

  var elements = document.body.content;
  var inlineObjects = document.inlineObjects;

  var orderedElements = [];

  var headers = document.headers;

  // Look for a main article image in the header
  if (headers !== null && headers !== undefined) {
    if (Object.keys(headers).length === 1) {
      var headerKey = Object.keys(headers)[0];
      var header = headers[headerKey];
      var headerContent = header.content;
      headerContent.forEach(content => {
        content.paragraph.elements.forEach(element => {
          var headerElement = {
            type: null,
            children: []
          };
          if ( element.inlineObjectElement && element.inlineObjectElement.inlineObjectId) {
            headerElement.type = "mainImage";
            var imageID = element.inlineObjectElement.inlineObjectId;
            var fullImageData = inlineObjects[imageID];
            if (fullImageData) {
              var s3Url = uploadImageToS3(imageID, fullImageData.inlineObjectProperties.embeddedObject.imageProperties.contentUri);

              var childImage = {
                index: element.endIndex,
                height: fullImageData.inlineObjectProperties.embeddedObject.size.height.magnitude,
                width: fullImageData.inlineObjectProperties.embeddedObject.size.width.magnitude,
                imageId: element.inlineObjectElement.inlineObjectId,
                imageUrl: s3Url,
                imageAlt: cleanContent(fullImageData.inlineObjectProperties.embeddedObject.title)
              };
              headerElement.children.push(childImage);
            }
          }
          if (headerElement.type !== null) {
            orderedElements.push(headerElement);
          }
        });
      });
    }
  }

  var listInfo = {};
  var listItems = DocumentApp.getActiveDocument().getListItems();
  listItems.forEach(li => {
    var id = li.getListId();
    var glyphType = li.getGlyphType();
    listInfo[id] = glyphType;
  })

  elements.forEach(element => {
    if (element.paragraph && element.paragraph.elements) {
      var eleData = {
        children: [],
        link: null,
        type: null,
        index: element.endIndex
      };

      // handle list items
      if (element.paragraph.bullet) {
        eleData.items = [];
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
        // just append this element's text to the exist list's items
        if (listElementIndex > 0) {
          var listElement = orderedElements[listElementIndex];
          var listElementChildren = [];
          element.paragraph.elements.forEach(subElement => {
            // append list items to the main list element's children
            listElementChildren.push({
              content: cleanContent(subElement.textRun.content),
              style: cleanStyle(subElement.textRun.textStyle)
            })
          });
          listElement.items.push({
            children: listElementChildren,
            index: eleData.index,
            nestingLevel: nestingLevel
          })
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
          var listElementChildren = [];
          element.paragraph.elements.forEach(subElement => {
            // append list items to the main list element's children
            listElementChildren.push({
              content: cleanContent(subElement.textRun.content),
              style: cleanStyle(subElement.textRun.textStyle)
            })
          });
          eleData.items.push({
            nestingLevel: nestingLevel,
            children: listElementChildren,
            index: eleData.index
          })
          orderedElements.push(eleData);
        }
      }

      // filter out blank subelements
      var subElements = element.paragraph.elements.filter(subElement => subElement.textRun && subElement.textRun.content.trim().length > 0)
      // try to find an embeddable link: url on its own line matching one of a set of hosts (twitter, youtube, etc)
      if (subElements.length === 1) {
        var foundLink = subElements.find(subElement => subElement.textRun.textStyle.hasOwnProperty('link'))
        var linkUrl = null;
        var embeddableUrlRegex = /twitter\.com|youtube\.com|youtu\.be|google\.com|imgur.com|twitch\.tv|vimeo\.com|mixcloud\.com|instagram\.com|facebook\.com|dailymotion\.com/i;
        if (foundLink) {
          linkUrl = foundLink.textRun.textStyle.link.url;
        // try to find a URL by itself that google hasn't auto-linked
        } else if(embeddableUrlRegex.test(subElements[0].textRun.content.trim())) {
          linkUrl = subElements[0].textRun.content.trim();
        }
        if ( linkUrl !== null) {
          var embeddableUrl = embeddableUrlRegex.test(linkUrl);
          if (embeddableUrl) {
            eleData.type = "embed";
            eleData.link = linkUrl;
            orderedElements.push(eleData);
          } else {
            Logger.log("url not embeddable: ", linkUrl);
          }
        } else {
          // Logger.log("linkUrl is null: ", subElements[0].textRun.content);
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

              var s3Url = uploadImageToS3(imageID, fullImageData.inlineObjectProperties.embeddedObject.imageProperties.contentUri);

              var childImage = {
                index: subElement.endIndex,
                height: fullImageData.inlineObjectProperties.embeddedObject.size.height.magnitude,
                width: fullImageData.inlineObjectProperties.embeddedObject.size.width.magnitude,
                imageId: subElement.inlineObjectElement.inlineObjectId,
                imageUrl: s3Url,
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


/*
.* Gets elements and formats them into JSON structure for us to work with on the front-end
.*/
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
      style: element.style,
      link: element.link,
      listType: element.listType
    };
    if (formattedElement.type === "list") {
      formattedElement.listType = element.listType;
      formattedElement.items = element.items;
    } else {
      formattedElement.children = element.children;
    }
    formattedElements.push(formattedElement);
  })
  return formattedElements;
}

//
// GraphQL functions
//

/**
 * Creates a new revision of the article
 * @param versionID
 * @param title
 * @param elements
 */
function createArticleFrom(versionID, title, elements) {
  Logger.log("createArticleFrom versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating article: unable to find a default locale';
    }
  }

  // var byline = getByline();

  var publishingInfo = getPublishingInfo();
  var seoData = getSEO();

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);
  Logger.log("article category name: ", categoryName);

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = createArticleSlug(categoryName, title);
    storeArticleSlug(slug);
  }

  var articleAuthors = getAuthors(); // only id
  Logger.log("createArticleFrom articleAuthors: ", articleAuthors);

  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow
  let byline;

  // compare all tags array to those selected for this article
  var authorsArrayForGraphQL = [];
  var authorSlugs = [];
  allAuthors.forEach(author => {
    const result = articleAuthors.find( ({ id }) => id === author.id );
    if (result !== undefined) {
      // just try to publish it because the article won't publish with any unpublished authors :(
      // TODO: see if there's a way to optimise this so we're not unnecessarily publishing authors
      publishAuthor(author.id);
      authorsArrayForGraphQL.push({
        locale: localeID,
        value: [
          {
            id: author.id,
            name: author.name.value
          }
        ]
      });
      authorSlugs.push(author.slug.value);
    }
  });

  if (authorSlugs.length > 0) {
    Logger.log("authorSlugs:", authorSlugs);
    byline = authorSlugs.join(' ');
    Logger.log("article byline:", byline);
  }

  var articleTags = getTags(); // only id
  Logger.log("createArticleFrom articleTags: ", articleTags);
  // create any new tags
  const newTags = articleTags.filter(articleTag => articleTag.newTag === true);
  Logger.log("createArticleFrom newTags: ", newTags);
  if (newTags.length > 0) {
    newTags.forEach(newTag => {
      Logger.log("createArticleFrom creating new tag: ", newTag);
      createTag(newTag.title);
    })
  }

  var allTags = getValueJSON('ALL_TAGS'); // don't look up in the DB again, too slow

  // compare all tags array to those selected for this article
  var tagsArrayForGraphQL = [];
  allTags.forEach(tag => {
    const result = articleTags.find( ({ id }) => id === tag.id );
    if (result !== undefined) {

      // just try to publish it because the article won't publish with any unpublished tags :(
      // TODO: see if there's a way to optimise this so we're not unnecessarily publishing tags
      publishTag(tag.id);
      tagsArrayForGraphQL.push({
        locale: localeID,
        value: [
          {
            id: tag.id,
            name: tag.title.value
          }
        ]
      });
    }
  });

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
        slug: {
          values:[
            {
              value: slug,
              locale: localeID
            }
          ]
        },
        category: {
          values: [
            {
              value: categoryID,
              locale: localeID
            }
          ]
        },
        firstPublishedOn: {
          values:[
            {
              value: publishingInfo.firstPublishedOn,
              locale: localeID
            }
          ]
        },
        lastPublishedOn: {
          values:[
            {
              value: publishingInfo.lastPublishedOn,
              locale: localeID
            }
          ]
        },
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
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
        authors: {
          values: authorsArrayForGraphQL
        },

    		tags: {
          values: tagsArrayForGraphQL
        },
        searchTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.searchTitle,
            },
          ],
        },
        searchDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.searchDescription,
            },
          ],
        },
        facebookTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.facebookTitle,
            },
          ],
        },
        facebookDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.facebookDescription,
            },
          ],
        },
        twitterTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.twitterTitle,
            },
          ],
        },
        twitterDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.twitterDescription,
            },
          ],
        },
      },
    },
  };
  Logger.log("formData: ", formData);
  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  Logger.log("createArticleFrom response:", responseText);
  var responseData = JSON.parse(responseText);
  Logger.log("createArticleFrom responseData:", responseData);
  var latestVersionID = responseData.data.content.data.id;
  storeArticleID(latestVersionID);
  return response;
}

/**
. * Posts document contents to graphql, creating a new article
. */
function createArticle(title, elements) {

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating article: unable to find a default locale';
    }
  }

  var publishingInfo = getPublishingInfo();
  var seoData = getSEO();

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = createArticleSlug(categoryName, title);
    storeArticleSlug(slug);
  }

  var articleAuthors = getAuthors(); // only id
  Logger.log("createArticle articleAuthors: ", articleAuthors);

  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow
  let byline;

  // compare all tags array to those selected for this article
  var authorsArrayForGraphQL = [];
  var authorSlugs = [];
  allAuthors.forEach(author => {
    const result = articleAuthors.find( ({ id }) => id === author.id );
    if (result !== undefined) {
      // just try to publish it because the article won't publish with any unpublished authors :(
      // TODO: see if there's a way to optimise this so we're not unnecessarily publishing authors
      publishAuthor(author.id);
      authorsArrayForGraphQL.push({
        locale: localeID,
        value: [
          {
            id: author.id,
            name: author.name.value
          }
        ]
      });
      authorSlugs.push(author.slug.value);
    }
  });

  if (authorSlugs.length > 0) {
    byline = authorSlugs.join(' ');
    Logger.log("article byline:", byline);
  }
  var allTags = getValueJSON('ALL_TAGS'); // don't look up in the DB again, too slow
  var articleTags = getTags();

  // compare all tags array to those selected for this article
  var tagsArrayForGraphQL = [];
  allTags.forEach(tag => {
    const result = articleTags.find( ({ id }) => id === tag.id );
    if (result !== undefined) {
      tagsArrayForGraphQL.push({
        locale: localeID,
        value: [
          {
            id: tag.id,
            name: tag.title.value
          }
        ]
      });
    }
  });

  var formData = {
    query:
      'mutation CreateBasicArticle($data: BasicArticleInput!) {\n  content: createBasicArticle(data: $data) {\n    data {\n      id\n      headline {\n        values {\n          value\n          locale\n        }\n      }\n      content {\n        values {\n          value\n          locale\n        }\n      }\n      byline {\n        values {\n          value\n          locale\n        }\n      }\n    }\n    error {\n      message\n      code\n      data\n    }\n  }\n}',
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
        slug: {
          values:[
            {
              value: slug,
              locale: localeID
            }
          ]
        },
        category: {
          values: [
            {
              value: categoryID,
              locale: localeID
            }
          ]
        },
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
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
    		tags: {
          values: tagsArrayForGraphQL
        },
    		authors: {
          values: authorsArrayForGraphQL
        },
        searchTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.searchTitle,
            },
          ],
        },
        searchDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.searchDescription,
            },
          ],
        },
        facebookTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.facebookTitle,
            },
          ],
        },
        facebookDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.facebookDescription,
            },
          ],
        },
        twitterTitle: {
          values: [
            {
              locale: localeID,
              value: seoData.twitterTitle,
            },
          ],
        },
        twitterDescription: {
          values: [
            {
              locale: localeID,
              value: seoData.twitterDescription,
            },
          ],
        },
      },
    },
  };

  var options = {
    method: 'post',
    muteHttpExceptions: true,
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

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

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
        content {
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
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
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
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  Logger.log(response.getContentText());
  return response;
}

/**
 * Deletes the article
 */
function deleteArticle() {
  var versionID = getArticleID();
  Logger.log("publishing article versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `mutation DeleteBasicArticle($revision: ID!) {
      content: deleteBasicArticle(where: {id: $revision}) {
        data
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
    muteHttpExceptions: true,
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

  if (responseData && responseData.data.content.data !== null) {
    // TODO wipe out all article metadata (ID, published dates)
    deleteArticleID();
    deletePublishingInfo();
    Logger.log("Deleted ArticleID and PublishingInfo.")

    return "Deleted article at revision " + versionID;
  } else {
    return responseData.data.content.error;
  }
}

/**
 * Publishes the article
 */
function publishArticle() {
  var versionID = getArticleID();
  Logger.log("publishing article versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

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
    muteHttpExceptions: true,
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

function listCategories() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  var formData = {
    query: `query listCategories {
      content: listCategories {
        data {
          id
          title {
            value
          }
          slug {
            value
          }
        } 
      }
    }`
  };
  var options = {
    method: 'post',
    muteHttpExceptions: true,
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

  if (responseData && responseData.data && responseData.data.content && responseData.data.content.data !== null) {
    return responseData.data.content.data;
  } else {
    return responseData.data.content.error;
  }
}

function loadAuthorsFromDB() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  var formData = {
    query: `query listAuthors {
      content: listAuthors {
        data {
          id
          name {
            value
          }
          slug {
            value
          }
        }
      }
    }`
  };
  var options = {
    method: 'post',
    muteHttpExceptions: true,
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

  if (responseData && responseData.data && responseData.data.content && responseData.data.content.data !== null) {
    return responseData.data.content.data;
  } else {
    return responseData.data.content.error;
  }
}

function loadTagsFromDB() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  var formData = {
    query: `query listTags {
      content: listTags {
        data {
          id
          title {
            value
          }
        }
      }
    }`
  };
  var options = {
    method: 'post',
    muteHttpExceptions: true,
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

  if (responseData && responseData.data && responseData.data.content && responseData.data.content.data !== null) {
    return responseData.data.content.data;
  } else {
    return responseData.data.content.error;
  }
}

// todo move to utility
function tagExists(tagData) {
  return tagData.title === 'cherries';
}

function addTagToLocalStore(formObject) {
  var tagTitle = formObject['new-article-tag'];
  var articleTags = getTags();
  const result = articleTags.find( ({ title }) => title === tagTitle );
  if (result !== undefined) {
    Logger.log("Tag already exists: ", result);
    return "Tag already exists: ", tagTitle;
  } else {
    articleTags.push({
      id: null,
      title: tagTitle
    });
    storeTags(articleTags);
    return "Stored new tag: ", tagTitle
  }
}

function publishAuthor(authorID) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
      query: `mutation PublishAuthor($revision: ID!) {
      content: publishAuthor(revision: $revision) {
        data {
          id
          meta {
            publishedOn
            published
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
      revision: authorID
    }
  };
  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  Logger.log("formData: ", JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );

  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log("responseData: ", responseData);

  if (responseData && responseData.data && responseData.data.content.error !== null) {
    Logger.log("Error publishing author ", authorID, ": ", responseData.data.content.error);
    return false;
  } else if (responseData && responseData.data && responseData.data.content && responseData.data.content.data) {
    var publishedSuccessfully = responseData.data.content.data.meta.published;
    if (publishedSuccessfully) {
      Logger.log("Published author with id ", authorID, " successfully.")
      return true;
    } else {
      Logger.log("Something went wrong publishing author with id ", authorID, ": ", responseData);
      return false;
    }
  } else {
    Logger.log("Something went wrong publishing author with id ", authorID, ": ", responseData);
    return false;
  }
}

function publishTag(tagID) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
      query: `mutation PublishTag($revision: ID!) {
      content: publishTag(revision: $revision) {
        data {
          id
          meta {
            publishedOn
            published
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
      revision: tagID
    }
  };
  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  Logger.log("formData: ", JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );

  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log("responseData: ", responseData);

  if (responseData && responseData.data && responseData.data.content.error !== null) {
    Logger.log("Error publishing tag ", tagID, ": ", responseData.data.content.error);
    return false;
  } else if (responseData && responseData.data && responseData.data.content && responseData.data.content.data) {
    var publishedSuccessfully = responseData.data.content.data.meta.published;
    if (publishedSuccessfully) {
      Logger.log("Published tag with id ", tagID, " successfully.")
      return true;
    } else {
      Logger.log("Something went wrong publishing tag with id ", tagID, ": ", responseData);
      return false;
    }
  } else {
    Logger.log("Something went wrong publishing tag with id ", tagID, ": ", responseData);
    return false;
  }
}

function createTag(tagTitle) {
  Logger.log("creating tag: ", tagTitle);
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var articleTags = getTags();
  const result = articleTags.find( ({ title }) => title === tagTitle );
  if (result !== undefined && !result.newTag && result.id !== null) {
    Logger.log("Tag already exists: ", result);
    return;
  }

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
    query: `mutation CreateTag($data: TagInput!) {
      content: createTag(data: $data) {
        data {
          id
          title {
            value
          }
          slug {
            value
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
        data: {
          title: {
            values: [
              {
                value: tagTitle,
                locale: localeID
              }
            ]
          },
          slug: {
            values: [
              {
                value: slugify(tagTitle),
                locale: localeID
              }
            ]
          }
        }
      }
  };
  Logger.log("tag formData: ", formData);
  var options = {
    method: 'post',
    muteHttpExceptions: true,
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

  var newTagData = responseData.data.content.data;

  // after creating the tag we have to publish it
  publishTag(newTagData.id);

  // if we found this tag already in the articleTags, update it with the ID and mark it as no longer new
  const tagIndex = articleTags.findIndex( ({title}) => title === tagTitle);
  if (tagIndex > 0) {
    Logger.log("created new tag, now updating articleTags data: ", articleTags[tagIndex]);
    articleTags[tagIndex].newTag = false;
    articleTags[tagIndex].id = newTagData.id;
    Logger.log("created new tag, updated articleTags data is: ", articleTags[tagIndex]);
  // otherwise just append the new tag data
  } else {
    Logger.log("created new tag, now appending it to articleTags data");
    articleTags.push({
      id: newTagData.id,
      newTag: false,
      title: newTagData.title
    });
    Logger.log("created new tag, appended it to articleTags data: ", articleTags);
  }

  // PUBLISH the tag as well
  // TODO
  storeTags(articleTags);

  return responseData;
}

function getLocales() {
  var scriptConfig = getScriptConfig();
  var PERSONAL_ACCESS_TOKEN = scriptConfig['PERSONAL_ACCESS_TOKEN'];
  var GRAPHQL_API = scriptConfig['GRAPHQL_API'];

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
    muteHttpExceptions: true,
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

function setArticleMeta() {
  var articleID = getArticleID();
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  // prefer custom headline (set in sidebar form) but fallback to document name
  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);
  Logger.log("article category name: ", categoryName);

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = createArticleSlug(categoryName, headline);
    storeArticleSlug(slug);
  }

  if (typeof(articleID) === "undefined" || articleID === null) {
    return null;
  }

  var formData = {
    query: `query getBasicArticle($id: ID!) {
      content: getBasicArticle(where: {id: $id}) {
        data {
          id
          savedOn
          tags {
            values {
              value {
                id
                title {
                  value
                }
              }
            }
          }
          meta {
            published
            publishedOn
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
                publishedOn
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
    muteHttpExceptions: true,
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
  var revisions = responseData.data.content.data.meta.revisions;

  // store publishing info like first & last dates published, latest version ID and whether or not it's been published
  var publishingInfo = {};

  revisions.forEach(revision => {
    if (revision.meta.latestVersion) {
      publishingInfo.latestVersionID = revision.id;
      publishingInfo.isLatestVersionPublished = revision.meta.published;
      publishingInfo.publishedOn = revision.meta.publishedOn;
    }
  })
  // weed out revisions with no published date, sort them and put in reverse chronological order
  var nonNullRevisions = revisions.filter(revision => revision.meta.publishedOn !== null);
  nonNullRevisions.sort(function (a, b) {
    var aDate = new Date(a.meta.publishedOn);
    var bDate = new Date(b.meta.publishedOn);
    return aDate > bDate;
  });
  nonNullRevisions.reverse();
  if (nonNullRevisions && nonNullRevisions[0] && nonNullRevisions[0].meta) {
    publishingInfo.firstPublishedOn = nonNullRevisions[0].meta.publishedOn;
  }
  if (nonNullRevisions && nonNullRevisions[nonNullRevisions.length - 1] && nonNullRevisions[nonNullRevisions.length - 1].meta) {
    publishingInfo.lastPublishedOn = nonNullRevisions[nonNullRevisions.length - 1].meta.publishedOn;
  }

  // the ID of the most recent revision of the article should now be treated as its articleID
  // save this in the document properties store
  if (publishingInfo.latestVersionID !== null) {
    Logger.log("storing article ID and publishingInfo: ", publishingInfo);
    storeArticleID(publishingInfo.latestVersionID);
    storePublishingInfo(publishingInfo);
  } else {
    Logger.log("NOT storing article ID and publishingInfo: ", publishingInfo);
  }

  var tagsData = responseData.data.content.data.tags.values;
  var tagIDs = [];
  tagsData.forEach(tagData => {
    tagData.value.forEach(tagValue => {
      tagIDs.push(tagValue.id)
    })
  });
  var uniqueTags = tagIDs.filter(onlyUnique);
  storeTags(uniqueTags);

  return responseData;
}

/*
.* called from Page.html, this function handles incoming form data from the sidebar,
.* setting the headline and byline (for now)
.*/
function processForm(formObject) {
  if (formObject === null || typeof(formObject) === "undefined") {
    return;
  }
  var headline = formObject["article-headline"];
  storeHeadline(headline);

  var byline = formObject["article-byline"];
  storeByline(byline);

  var authors = formObject["article-authors"];
  storeAuthors(authors);

  var tags = formObject["article-tags"];
  storeTags(tags);

  var categoryID = formObject["article-category"]
  storeCategoryID(categoryID);

  var seoData = {
    searchTitle: formObject["article-search-title"],
    searchDescription: formObject["article-search-description"],
    facebookTitle: formObject["article-facebook-title"],
    facebookDescription: formObject["article-facebook-description"],
    twitterTitle: formObject["article-twitter-title"],
    twitterDescription: formObject["article-twitter-description"],
  }

  storeSEO(seoData);

  return "Updated article metadata. You still need to publish the article for these changes to go live!"

}
