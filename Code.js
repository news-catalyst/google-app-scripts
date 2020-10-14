/**
 * The event handler triggered when installing the add-on.
 * @param {Event} e The onInstall event.
 */
function onInstall(e) {
  // Logger.log("onInstall running in authMode: ", e.authMode);
  onOpen(e);
}

/**
 * The event handler triggered when opening the document.
 * @param {Event} e The onOpen event.
 *
 * This adds a "Webiny" menu option.
 */
function onOpen(e) {
  // Logger.log("onOpen running in authMode: ", e.authMode);
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
  var scriptProperties = PropertiesService.getScriptProperties();
  var data = scriptProperties.getProperties();
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

function getCustomByline() {
  return getValue('ARTICLE_CUSTOM_BYLINE');
}

function storeCustomByline(customByline) {
  storeValue("ARTICLE_CUSTOM_BYLINE", customByline);
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
  if (typeof(result) !== 'undefined' && result.title && result.title.values && result.title.values[0] && result.title.values[0].value) {
    return result.title.values[0].value;
  } else {
    return null;
  }
}

function storePublishingInfo(info) {
  storeValue("PUBLISHING_INFO", JSON.stringify(info));
}

function getPublishingInfo(updateDates) {
  var publishingInfo = JSON.parse(getValue("PUBLISHING_INFO"));
  if (updateDates || publishingInfo === null || publishingInfo === undefined) {
    if (publishingInfo === null) {
      publishingInfo = {};
    }
    let pubDate = new Date();
    let pubDateString = pubDate.toISOString();
    Logger.log("setting published dates to:", pubDateString);
    publishingInfo.firstPublishedOn = pubDateString;
    publishingInfo.lastPublishedOn = pubDateString;
    publishingInfo.publishedOn = pubDateString;
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

function deleteTags() {
  deleteValue('ARTICLE_TAGS');
}

function deleteCategories() {
  return deleteValue('ALL_CATEGORIES');
}

// space delimited string of author slugs
function getAuthorSlugs() {
  return getValue('ARTICLE_AUTHOR_SLUGS');
}

// space delimited string of author slugs
function storeAuthorSlugs(authorSlugs) {
  storeValue("ARTICLE_AUTHOR_SLUGS", authorSlugs);
}

// array of author data
function getAuthors() {
  return getValueJSON('ARTICLE_AUTHORS');
}

// array of author data
function storeAuthors(authors) {
  if (authors === undefined) {
    Logger.log("storeAuthors called with undefined authors argument")
    return;
  }
  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow
  var storableAuthors = [];

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

  Logger.log("storableTags:", storableTags);
  storeValueJSON("ARTICLE_TAGS", storableTags);
}

function getSEO() {
  seoValue = getValueJSON('ARTICLE_SEO');
  if (seoValue === null || seoValue.length <= 0) {
    seoValue = {
      searchTitle: "",
      searchDescription: "",
      facebookTitle: "",
      facebookDescription: "",
      twitterTitle: "",
      twitterDescription: ""
    }
  }
  return seoValue;
}

function storeSEO(seoData) {
  storeValueJSON("ARTICLE_SEO", seoData);
}

function storeDocumentType(value) {
  storeValue('DOCUMENT_TYPE', value);
}

function getDocumentType() {
  var val = getValue('DOCUMENT_TYPE');
  return val;
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

  // first determine if the document is an article or a static page for the site
  // this is based on which folder the document is in: 'pages' (static pages) or anything else (articles)
  // in order to do this we need to use the Google Drive API
  // which requires the "https://www.googleapis.com/auth/drive.readonly" scope
  var documentID = DocumentApp.getActiveDocument().getId();
  var driveFile = DriveApp.getFileById(documentID)
  var fileParents = driveFile.getParents();
  var isStaticPage = false;
  while ( fileParents.hasNext() ) {
    var folder = fileParents.next();
    if (folder.getName() === "pages") {
      isStaticPage = true;
    }
  }

  var documentType = 'article';
  if (isStaticPage) {
    documentType = 'page';
  }
  storeDocumentType(documentType);

  var articleID = getArticleID();

  var publishingInfo = getPublishingInfo();

  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var customByline = getCustomByline();

  var authorSlugsValue;
  var authorSlugs = [];
  var articleAuthors = getAuthors();
  var allAuthors = loadAuthorsFromDB();
  Logger.log("Loaded authors from DB", allAuthors);
  if (allAuthors) {
    storeAllAuthors(allAuthors);
    allAuthors.forEach(author => {
      const result = articleAuthors.find( ({ id }) => id === author.id );
      if (result !== undefined) {
        Logger.log("storing author slug:", author.slug)
        authorSlugs.push(author.slug);
      }
    });
  }


  if (authorSlugs.length > 0) {
    authorSlugsValue = authorSlugs.join(' ');
    storeAuthorSlugs(authorSlugsValue);
  }

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
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
  if (allTags) {
    storeAllTags(allTags);
  }

  var articleTags = getTags();

  var seoData = getSEO();

  var scriptConfig = getScriptConfig();
  var previewUrl = scriptConfig['PREVIEW_URL']
  var previewSecret = scriptConfig['PREVIEW_SECRET'];
  var accessToken = scriptConfig['ACCESS_TOKEN'];
  var contentApi = scriptConfig['CONTENT_API'];
  var awsAccessKey = scriptConfig['AWS_ACCESS_KEY_ID'];
  var awsSecretKey = scriptConfig['AWS_SECRET_KEY'];
  var awsBucket = scriptConfig['AWS_BUCKET'];
  var republishUrl = scriptConfig['VERCEL_DEPLOY_HOOK_URL'];

  if (typeof(articleID) === "undefined" || articleID === null) {

    return {
      awsAccessKey: awsAccessKey,
      awsSecretKey: awsSecretKey,
      awsBucket: awsBucket,
      documentType: documentType,
      accessToken: accessToken,
      contentApi: contentApi,
      previewUrl: previewUrl,
      previewSecret: previewSecret,
      articleID: null,
      headline: headline,
      customByline: customByline,
      authorSlugs: authorSlugsValue,
      publishingInfo: publishingInfo,
      allAuthors: allAuthors,
      articleAuthors: articleAuthors,
      allTags: allTags,
      articleTags: articleTags,
      categories: categories,
      categoryID: categoryID,
      categoryName: categoryName,
      slug: slug,
      seo: seoData,
      republishUrl: republishUrl
    }
  }

  var articleMetadata = {
    awsAccessKey: awsAccessKey,
    awsSecretKey: awsSecretKey,
    awsBucket: awsBucket,
    documentType: documentType,
    accessToken: accessToken,
    contentApi: contentApi,
    previewUrl: previewUrl,
    previewSecret: previewSecret,
    articleID: articleID,
    headline: headline,
    customByline: customByline,
    authorSlugs: authorSlugsValue,
    publishingInfo: publishingInfo,
    allAuthors: allAuthors,
    articleAuthors: articleAuthors,
    allTags: allTags,
    articleTags: articleTags,
    categories: categories,
    categoryID: categoryID,
    categoryName: categoryName,
    slug: slug,
    seo: seoData,
    republishUrl: republishUrl
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
  Logger.log("START handlePublish:", formObject);
  // save the article - pass publishFlag as true
  var message = getCurrentDocContents(formObject, true);
  Logger.log("END handlePublish: ", message)
  return message;
}

/**
 * 
 * Saves the article as a draft, opens preview
 * @param {} formObject 
 */
function handlePreview(formObject) {
  Logger.log("START handlePreview:", formObject);
  // save the article - pass publishFlag as false
  var message = getCurrentDocContents(formObject, false);

  // construct preview url
  var slug = getArticleSlug();

  var scriptConfig = getScriptConfig();
  var previewHost = scriptConfig['PREVIEW_URL'];
  var previewSecret = scriptConfig['PREVIEW_SECRET'];
  var fullPreviewUrl = previewHost + "?secret=" + previewSecret + "&slug=" + slug;

  // open preview url in new window
  message += "<br><a href='" + fullPreviewUrl + "' target='_blank'>Preview article in new window</a>"

  Logger.log("END handlePreview: ", message)
  return message;
}

/**
. * Gets the current document's contents and
.  * posts them to webiny
. */
function getCurrentDocContents(formObject, publishFlag) {
  var documentType = getDocumentType();

  var propMessage = processForm(formObject);

  var title = getHeadline();
  var formattedElements = formatElements();

  var articleID = getArticleID();

  // first save the latest article content - either create a new article, or create a new revision on an existing article
  var responseData;
  // if we already have an articleID and latest version info, we need to create a new version of the article
  if (articleID !== null) {
    if (documentType === "article") {
      Logger.log("updating article id", articleID)
      responseData = createArticleFrom(articleID, title, formattedElements);
    } else {
      Logger.log("updating page id", articleID)
      responseData = createPageFrom(articleID, title, formattedElements);
    }
  // otherwise, we create a new article
  } else {
    if (documentType === "article") {
      Logger.log("creating new article")
      responseData = createArticle(title, formattedElements);
    } else {
      Logger.log("creating new page")
      responseData = createPage(title, formattedElements);
    }
  }

  Logger.log("responseData:", responseData);
  var articleID = responseData.id;
  storeArticleID(articleID);

  // var webinyResponseCode = webinyResponse.getResponseCode();
  // var responseText;
  // if (webinyResponseCode === 200) {
    responseText = `Successfully stored ${documentType} in webiny.`;
  // } else {
  //   responseText = 'Webiny responded with code ' + webinyResponseCode;
  // }

  if (publishFlag) {
    // Logger.log(`Publishing ${documentType}...`)
    if (documentType === "article") {
      // publish article
      var publishResponse = publishArticle();
      // Logger.log(`Done publishing ${documentType}:`, publishResponse);

      responseText += "<br>" + JSON.stringify(publishResponse);
    } else {
      // publish page
      var publishResponse = publishPage();
      // Logger.log(`Done publishing ${documentType}:`, publishResponse);

      responseText += "<br>" + JSON.stringify(publishResponse);
    }
    // hit vercel deploy hook to republish the site
    var rebuildResponse = rebuildSite();
    // Logger.log(`Posted to deploy hook to rebuild: `, rebuildResponse);
    responseText += "<br>Rebuilding site on vercel";
    responseText += "<br>" + JSON.stringify(rebuildResponse);
  }

  // // update published flag and latest version ID
  // setArticleMeta();

  return responseText;
}


/*
.* Retrieves "elements" from the google doc - which are headings, images, paragraphs, lists
.* Preserves order, indicates that order with `index` attribute
.*/
function getElements() {
  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = activeDoc.getId();
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
  var listItems = activeDoc.getListItems();
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
            // Logger.log("url not embeddable: ", linkUrl);
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
 * Creates a new revision of the page
 * @param versionID
 * @param title
 * @param elements
 */
function createPageFrom(versionID, title, elements) {
  // Logger.log("createPageFrom versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var localeID = getLocaleID();
  if (localeID === null) {
    var locales = getLocales();
    setDefaultLocale(locales);
    localeID = getLocaleID();
    if (localeID === null) {
      return 'Failed updating page: unable to find a default locale';
    }
  }

  var seoData = getSEO();

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = slugify(title);
    storeArticleSlug(slug);
  }

  var formData = {
    query: `mutation UpdatePage($id: ID!, $data: PageInput!) {
      pages { 
        updatePage(id: $id, data: $data) {
          data {
            id
            slug
            headline {
              values {
                value
              }
            }
            content {
              values {
                value
                locale
              }
            }
            searchTitle {
              values {
                value
                locale
              }
            }
            searchDescription {
              values {
                value
                locale
              }
            }
            facebookTitle {
              values {
                value
                locale
              }
            }
            facebookDescription {
              values {
                value
                locale
              }
            }
            twitterTitle {
              values {
                value
                locale
              }
            }
            twitterDescription {
              values {
                value
                locale
              }
            }
          }
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
        slug: slug,
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
            },
          ],
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
  // Logger.log("formData: ", formData);
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
  // Logger.log("createPageFrom response:", responseText);
  var responseData = JSON.parse(responseText);
  // Logger.log("createPageFrom responseData:", responseData);
  // var latestVersionID = responseData.data.content.data.id;
  // storeArticleID(latestVersionID);
  return responseData.data.pages.updatePage.data;
}

/**
 * Updates the article; formerly called a mutation called CreateArticleFrom, hence the strange name
 * @param versionID
 * @param title
 * @param elements
 */
function createArticleFrom(versionID, title, elements) {
  Logger.log("START createArticleFrom");

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

  var customByline = getCustomByline();

  var publishingInfo = getPublishingInfo(true);
  var seoData = getSEO();

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);
  // Logger.log("article category name: ", categoryName);

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = createArticleSlug(categoryName, title);
    storeArticleSlug(slug);
  }

  var articleAuthors = getAuthors(); // only id

  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow
  let authorSlugsValue;

  // compare all tags array to those selected for this article
  var authorIDs = [];
  var authorSlugs = [];
  allAuthors.forEach(author => {
    const result = articleAuthors.find( ({ id }) => id === author.id );
    if (result !== undefined) {
      authorIDs.push(author.id);
      authorSlugs.push(author.slug);
    }
  });

  if (authorSlugs.length > 0) {
    authorSlugsValue = authorSlugs.join(' ');
  }

  var articleTags = getTags(); // only id
  // Logger.log("createArticleFrom articleTags: ", articleTags);
  // create any new tags
  const newTags = articleTags.filter(articleTag => articleTag.newTag === true);
  Logger.log("createArticleFrom newTags: ", newTags);
  if (newTags.length > 0) {
    newTags.forEach(newTag => {
      Logger.log("createArticleFrom creating new tag: ", newTag);
      createTag(newTag.title);
    })
  }

  var allTags = getAllTags(); // don't look up in the DB again, too slow
  // Logger.log("allTags:", allTags);

  var articleTags = getTags(); // refresh list of tags for this article as some may have been created just above
  // Logger.log("2 articleTags:", articleTags);
  // compare all tags array to those selected for this article
  var tagIDs = [];
  allTags.forEach(tag => {
    const result = articleTags.find( ({ id }) => id === tag.id );
    if (result !== undefined) {
      Logger.log("found tag: ", tag);
      tagIDs.push(tag.id);
    }
  });

  Logger.log("tagIDs: ", tagIDs);
  var variables = {
      id: versionID,
      data: {
        slug: slug,
        category: categoryID,
        firstPublishedOn: publishingInfo.firstPublishedOn,
        lastPublishedOn: publishingInfo.lastPublishedOn,
        customByline: customByline,
        authors: authorIDs,
        authorSlugs: authorSlugsValue,
    		tags: tagIDs,
        headline: {
          values: [
            {
              locale: localeID,
              value: title,
            },
          ],
        },
        headlineSearch: title,
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
            },
          ],
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
      }
  };
  Logger.log("variables:", variables);

  var formData = {
    query: `mutation UpdateArticle($id: ID!, $data: ArticleInput!) {
      articles { 
        updateArticle(id: $id, data: $data) {
          error {
            code
            message
          }
          data {
            id
            headline {
              values {
                value
              }
            }
            headlineSearch
            authors {
              id
              name
            }
            category {
              slug
            }
            tags {
              id
              title {
                values {
                  value
                }
              }
              slug
            }
          }
        }
      }
    }`,
    variables: variables
  };
  // Logger.log("formData: ", formData);
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
  // Logger.log("createArticleFrom response:", responseText);
  var responseData = JSON.parse(responseText);
  // Logger.log("createArticleFrom responseData:", responseData);
  Logger.log("END createArticleFrom:", responseText);
  return responseData.data.articles.updateArticle.data;
}

/**
. * Posts document contents to graphql, creating a new page
. */
function createPage(title, elements) {

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

  var seoData = getSEO();

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = slugify(title);
    storeArticleSlug(slug);
  }

  var formData = {
    query:
      `mutation CreatePage($data: PageInput!) {
        pages {
            createPage(data: $data) {
                data {
                    id
                    slug
                    headline {
                      values {
                        value                    
                      }
                    }
                    content {
                      values {
                        value
                        locale
                      }
                    }
                    searchTitle {
                      values {
                        value
                        locale
                      }
                    }
                    searchDescription {
                      values {
                        value
                        locale
                      }
                    }
                    facebookTitle {
                      values {
                        value
                        locale
                      }
                    }
                    facebookDescription {
                      values {
                        value
                        locale
                      }
                    }
                    twitterTitle {
                      values {
                        value
                        locale
                      }
                    }
                    twitterDescription {
                      values {
                        value
                        locale
                      }
                    }
                }
                error  {
                  code
                  message
                  data
              }
            }
        }
    }`,
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
        slug: slug,
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
            },
          ],
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

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log("responseData:", responseData);
  return responseData.data.pages.createPage.data;
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

  var customByline = getCustomByline();
  var publishingInfo = getPublishingInfo(true);
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
  // Logger.log("createArticle articleAuthors: ", articleAuthors);

  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow

  let authorSlugsValue;

  // compare all tags array to those selected for this article
  var authorIDs = [];
  var authorSlugs = [];
  allAuthors.forEach(author => {
    const result = articleAuthors.find( ({ id }) => id === author.id );
    if (result !== undefined) {
      authorIDs.push(author.id);
      authorSlugs.push(author.slug);
    }
  });

  if (authorSlugs.length > 0) {
    authorSlugsValue = authorSlugs.join(' ');
  }

  var articleTags = getTags(); // only id
  // Logger.log("createArticle articleTags: ", articleTags);
  // create any new tags
  const newTags = articleTags.filter(articleTag => articleTag.newTag === true);
  // Logger.log("createArticle newTags: ", newTags);
  if (newTags.length > 0) {
    newTags.forEach(newTag => {
      // Logger.log("createArticle creating new tag: ", newTag);
      createTag(newTag.title);
    })
  }

  var allTags = getAllTags(); // don't look up in the DB again, too slow
  // Logger.log("allTags:", allTags);

  var articleTags = getTags(); // refresh list of tags for this article as some may have been created just above
  // Logger.log("articleTags:", articleTags);
  // compare all tags array to those selected for this article
  var tagIDs = [];
  allTags.forEach(tag => {
    const result = articleTags.find( ({ id }) => id === tag.id );
    if (result !== undefined) {
      tagIDs.push(tag.id);
    }
  });

  var formData = {
    query:
    `mutation CreateArticle($data: ArticleInput!) {
      articles { 
        createArticle(data: $data) {
          error {
            message
            code
            data
          }
          data {
            id
            headline {
              values {
                value
              }
            }
            headlineSearch
            authors {
              id
              name
            }
            category {
              slug
            }
            tags {
              slug
            }
          }
        }
      }
    }`,
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
        headlineSearch: title,
        slug: slug,
        category: categoryID,
        content: {
          values: [
            {
              locale: localeID,
              value: JSON.stringify(elements),
            },
          ],
        },
        customByline: customByline,
    		tags: tagIDs,
    		authors: authorIDs,
        authorSlugs: authorSlugsValue,
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
        firstPublishedOn: publishingInfo.firstPublishedOn,
        lastPublishedOn: publishingInfo.lastPublishedOn,
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );

  var responseText = response.getContentText();
  Logger.log("response text: ", responseText);
  var responseData = JSON.parse(responseText);
  Logger.log("responseData: ", responseData);
  return responseData.data.articles.createArticle.data;
}

/**
 * Deletes the article
 */
function deleteArticle() {
  var versionID = getArticleID();

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `mutation DeleteArticle($id: ID!) {
      articles {
        deleteArticle(id: $id) {
          data
          error {
            code
            message
          }
        }
      }
    }`,
    variables: {
      id: versionID,
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  // Logger.log(responseData);

  deleteArticleID();
  deletePublishingInfo();
  deleteTags();
  deleteCategories();
  if (responseData && responseData.data.articles.deleteArticle.error === null) {
    return "Deleted article at revision " + versionID;
  } else {
    return responseData.data.articles.deleteArticle.error;
  }
}

function publishPage() {
  Logger.log("START publishPage");
  var versionID = getArticleID();
  // Logger.log("publishing article versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var publishingInfo = getPublishingInfo(true);
  var formData = {
    query: `mutation UpdatePage($id: ID!, $data: PageInput!) {
      pages { 
        updatePage(id: $id, data: $data) {
          data {
            id
            firstPublishedOn
            lastPublishedOn
            published
          }
        }
      }
    }`,
    variables: {
      id: versionID,
      data: {
        published: true,
        firstPublishedOn: publishingInfo.firstPublishedOn,
        lastPublishedOn: publishingInfo.lastPublishedOn,
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  // Logger.log(responseData);

  // TODO update latestVersionPublished flag

  Logger.log("END publishPage");
  if (responseData && responseData.data && response.data.pages && response.data.pages.updatePage && response.data.pages.updatePage.data) {
    return "Published page at revision " + versionID;
  } else {
    return responseData.data.pages.updatePage.error;
  }
}


/**
 * Publishes the article
 */
function publishArticle() {
  Logger.log("START publishArticle");
  var versionID = getArticleID();
  // Logger.log("publishing article versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var publishingInfo = getPublishingInfo(true);
  var formData = {
    query: `mutation UpdateArticle($id: ID!, $data: ArticleInput!) {
      articles { 
        updateArticle(id: $id, data: $data) {
          error {
            code
            message
          }
          data {
            id
            firstPublishedOn
            lastPublishedOn
            published
          }
        }
      }
    }`,
    variables: {
      id: versionID,
      data: {
        published: true,
        firstPublishedOn: publishingInfo.firstPublishedOn,
        lastPublishedOn: publishingInfo.lastPublishedOn,
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log("publish response:", responseData);

  // TODO update latestVersionPublished flag

  Logger.log("END publishArticle");
  if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.updateArticle && responseData.data.articles.updateArticle.data) {
    return "Published article at revision " + versionID;
  } else {
    return responseData.data.articles.updateArticle.error;
  }
}

/**
 * Rebuilds the site by POSTing to deploy hook
 */
function rebuildSite() {
  Logger.log("START rebuildSite");
  var scriptConfig = getScriptConfig();
  var DEPLOY_HOOK = scriptConfig['VERCEL_DEPLOY_HOOK_URL'];

  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json'
  };

  var response = UrlFetchApp.fetch(
    DEPLOY_HOOK,
    options
  );
  var responseText = response.getContentText();
  // Logger.log(responseText);
  var responseData = JSON.parse(responseText);
  Logger.log("END rebuildSite");
  return responseData;
}

function listCategories() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  var formData = {
    query: `{
      categories	{
        listCategories {
          error {
            code
            message
          }
          data {
            id
            title {
              values {
                value
              }
            }
            slug
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  // Logger.log(responseData);

  if (responseData && responseData.data && responseData.data.categories && responseData.data.categories.listCategories && responseData.data.categories.listCategories.data !== null) {
    return responseData.data.categories.listCategories.data;
  } else {
    return responseData.data.categories.listCategories.error;
  }
}

function loadAuthorsFromDB() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  Logger.log("CONTENT_API:", CONTENT_API, "ACCESS_TOKEN:", ACCESS_TOKEN);
  var formData = {
    query: `
    {
      authors {
        listAuthors {
          error {
            code
            message
          }
          data {
            id
            name
            bio {
              values {
                value
              }
            }
            twitter
            title {
              values {
                value
              }
            }
            slug
            photoUrl
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

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log(responseData);

  if (responseData && responseData.data && responseData.data.authors && responseData.data.authors.listAuthors && responseData.data.authors.listAuthors.data !== null) {
    return responseData.data.authors.listAuthors.data;
  } else if (responseData && responseData.data && responseData.data.authors && responseData.data.authors.listAuthors && responseData.data.authors.listAuthors.error) {
    return responseData.data.authors.listAuthors.error;
  }
}

function loadTagsFromDB() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];
  var formData = {
    query: `{
      tags	{
        listTags {
          error {
            code
            data
            message
          }
          data {
            id
            title {
              values {
                value
              }
            }
            slug
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

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  Logger.log("tag response:", responseData);

  if (responseData && responseData.data && responseData.data.tags && responseData.data.tags.listTags && responseData.data.tags.listTags.data !== null) {
    return responseData.data.tags.listTags.data;
  } else if (responseData && responseData.data && responseData.data.tags && responseData.data.tags.listTags && responseData.data.tags.listTags.error) {
    return responseData.data.tags.listTags.error;
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
    // Logger.log("Tag already exists: ", result);
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

function createTag(tagTitle) {
  // Logger.log("creating tag: ", tagTitle);
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var articleTags = getTags();
  const result = articleTags.find( ({ title }) => title === tagTitle );
  if (result !== undefined && !result.newTag && result.id !== null) {
    // Logger.log("Tag already exists: ", result);
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
    query: ` mutation CreateTag($data: TagInput!) {
      tags {
          createTag(data: $data) {
            data {
              id
              title {
                values {
                  value                
                }
              }
              slug
              published
            }
            error  {
              code
              message
              data
            }
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
          slug: slugify(tagTitle),
          published: true
        }
      }
  };
  // Logger.log("tag formData: ", formData);
  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      authorization: ACCESS_TOKEN,
    },
    payload: JSON.stringify(formData),
  };

  // Logger.log(JSON.stringify(formData))
  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );

  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  // Logger.log(responseData);

  var newTagData = responseData.data.tags.createTag.data;

  var allTags = getAllTags();

  // if we found this tag already in the articleTags, update it with the ID and mark it as no longer new
  const tagIndex = articleTags.findIndex( ({title}) => title === tagTitle);
  if (tagIndex >= 0) {
    console.log("articleTags:", articleTags);
    console.log("Found tag at index:", tagIndex, articleTags[tagIndex]);
    // Logger.log("created new tag, now updating articleTags data: ", articleTags[tagIndex]);
    articleTags[tagIndex].newTag = false;
    articleTags[tagIndex].id = newTagData.id;
    // Logger.log("created new tag, updated articleTags data is: ", articleTags[tagIndex]);
    var allTagsData = {
      title: {
        value: articleTags[tagIndex].title
      },
      newTag: false,
      id: articleTags[tagIndex].id
    }
    allTags.push(allTagsData);
    // Logger.log("updated allTags is: ", allTags);

  // otherwise just append the new tag data
  } else {
    // Logger.log("tagTitle is:", tagTitle);
    // Logger.log("created new tag, now appending it to articleTags data: ", articleTags);
    let tagData ={
      id: newTagData.id,
      newTag: false,
      title: newTagData.title
    }
    articleTags.push(tagData);
    // Logger.log("created new tag, appended it to articleTags data: ", articleTags);
    // append to ALL_TAGS
    var allTagsData = {
      title: {
        value: tagData.title
      },
      newTag: false,
      id: tagData.id
    }
    allTags.push(tagData);
  }

  storeAllTags(allTags);
  storeTags(articleTags);

  return responseData;
}

function getLocales() {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

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
        ACCESS_TOKEN,
    },
    payload: JSON.stringify({ query: query }),
  };

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  // Logger.log(responseText);
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
  Logger.log("START setArticleMeta")
  var articleID = getArticleID();
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var documentType = getDocumentType();

  // prefer custom headline (set in sidebar form) but fallback to document name
  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    if (documentType === "article") {
      slug = createArticleSlug(categoryName, headline);
    } else {
      slug = slugify(headline);
    }
    storeArticleSlug(slug);
  }

  if (documentType !== "article") {
    return null;
  }

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);
  // Logger.log("article category name: ", categoryName);

  if (typeof(articleID) === "undefined" || articleID === null) {
    return null;
  }

  var formData = {
    query: `{
      articles {
        getArticle(id: "5f7536413b4f94000752c423") {
          error {
            message
            code
            data
          }
          data {
            id
            firstPublishedOn
            lastPublishedOn
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
            searchTitle {
              values {
                value
                locale
              }
            }
            searchDescription {
              values {
                value
                locale
              }
            }
            facebookTitle {
              values {
                value
                locale
              }
            }
            facebookDescription {
              values {
                value
                locale
              }
            }
            twitterTitle {
              values {
                value
                locale
              }
            }
            twitterDescription {
              values {
                value
                locale
              }
            }
            authorSlugs
            customByline
            slug
            authors {
              id
              name
              slug
            }
            category {
              id
              title {
                values {
                  value
                  locale
                }
              }
              slug
            }
            tags {
              id
              title {
                values {
                  value
                  locale
                }
              }
              slug
            }
          }
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

  // Logger.log(options);

  var response = UrlFetchApp.fetch(
    CONTENT_API,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  // Logger.log(responseData);

  let articleData = responseData.data.articles.getArticle.data;
  var articleID = articleData.id;

  // store publishing info like first & last dates published, latest version ID and whether or not it's been published
  var publishingInfo = {};
  publishingInfo.firstPublishedOn = articleData.firstPublishedOn;
  publishingInfo.lastPublishedOn = articleData.lastPublishedOn;
  publishingInfo.publishedOn = articleData.lastPublishedOn;

  var tagsData = responseData.data.articles.getArticle.data.tags;
  var tagIDs = [];
  tagsData.forEach(tagData => {
    tagIDs.push(tagData.id)
  });
  var uniqueTags = tagIDs.filter(onlyUnique);
  storeTags(uniqueTags);

  Logger.log("END setArticleMeta")
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

  var documentType = getDocumentType();

  if (documentType && documentType === "article") {
    var customByline = formObject["article-custom-byline"];
    storeCustomByline(customByline);

    var authors = formObject["article-authors"];
    if (authors !== undefined) {
      storeAuthors(authors);
    }

    var tags = formObject["article-tags"];
    if (tags !== undefined) {
      storeTags(tags);
    }

    var categoryID = formObject["article-category"]
    storeCategoryID(categoryID);
  }

  var seoData = {
    searchTitle: formObject["article-search-title"],
    searchDescription: formObject["article-search-description"],
    facebookTitle: formObject["article-facebook-title"],
    facebookDescription: formObject["article-facebook-description"],
    twitterTitle: formObject["article-twitter-title"],
    twitterDescription: formObject["article-twitter-description"],
  }

  storeSEO(seoData);

  return "Updated document metadata. You still need to publish for these changes to go live!"
}
