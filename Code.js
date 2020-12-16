const availableLocalesKey = 'AVAILABLE_LOCALES';
const localeNameKey = 'LOCALE_NAME';
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
    .addItem('Publishing Tools', 'showSidebar')
    .addItem('Administrator Tools', 'showSidebarManualAssociate')
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

/**
 * Displays a sidebar letting you manually associate this doc with an article
 * in Webiny.
 */
function showSidebarManualAssociate() {
  var html = HtmlService.createHtmlOutputFromFile('ManualPage')
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

function getIsPublished() {
  var value = getValue('IS_PUBLISHED');
  if (value === "true" || value === true) {
    Logger.log("getIsPublished:", typeof(value), value, "returning true");
    return true;
  } else {
    Logger.log("getIsPublished:", typeof(value), value, "returning false");
    return false
  }
}

function storeIsPublished(value) {
  Logger.log("storeIsPublished:", typeof(value), value);
  storeValue("IS_PUBLISHED", value);
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
  storeValue('LOCALE_ID', localeID);
}

function getSelectedLocaleName() {
  var value = getValue(localeNameKey);
  Logger.log("getSelectedLocaleName:", value);
  return value;
}

function storeSelectedLocaleName(localeName) {
  Logger.log("storing selected locale name:", localeName);
  storeValue(localeNameKey, localeName);
}

function getAvailableLocales() {
  var value = getValue(availableLocalesKey)
  return value;
}

function storeAvailableLocales(localesString) {
  Logger.log("storeAvailableLocales:", localesString);
  storeValue(availableLocalesKey, localesString);
}

function getArticleSlug() {
  return getValue('ARTICLE_SLUG');
}  

function storeArticleSlug(slug) {
  storeValue("ARTICLE_SLUG", slug);
}

function deleteArticleSlug() {
  deleteValue('ARTICLE_SLUG');
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

function generatePublishDate() {
  let pubDate = new Date();
  let pubDateString = pubDate.toISOString();
  return pubDateString;
}

function getPublishingInfo() {
  var publishingInfo = JSON.parse(getValue("PUBLISHING_INFO"));
  if (publishingInfo === null) {
    publishingInfo = {};
  }
  Logger.log("publishingInfo:", publishingInfo);
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
  deleteValue('ARTICLE_CATEGORY_ID');
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

  // Logger.log("storableTags:", storableTags);
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

function deleteSEO() {
  deleteValue("ARTICLE_SEO")
}

function storeDocumentType(value) {
  storeValue('DOCUMENT_TYPE', value);
}

function getDocumentType() {
  var val = getValue('DOCUMENT_TYPE');
  return val;
}

function getArticleDataByID(articleID) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `query GetArticle($id: ID!) {
      articles {
        getArticle(id: $id) {
          error {
            code
            message
            data
          }
          data {
            id
            headline {
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
            published
            firstPublishedOn
            lastPublishedOn
            googleDocs
            availableLocales
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
  var returnValue = {
    status: "",
    message: ""
  };

  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.getArticle && responseData.data.articles.getArticle.error === null) {
    returnValue.status = "success";
    returnValue.id = responseData.data.articles.getArticle.data.id;
    returnValue.data = responseData.data.articles.getArticle.data;
    returnValue.message = "Retrieved article with ID " +  returnValue.id;
  } else {
    returnValue.status = "error";
    returnValue.message = JSON.stringify(responseData);
    // "Error retrieving article with ID " +  articleID;
    // if (responseData.data.articles && responseData.data.articles.getArticle && responseData.data.articles.getArticle.error) {
    //   returnValue.message += ": " + JSON.stringify(responseData.data.articles.getArticle.error);
    // }
  }
  return returnValue;
}

//
// Functions for retrieving and formatting document contents
//

/*
. * Looks up an article in Webiny by Google Document ID
. *
*/
function getArticleByDocumentID(documentID) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `query SearchArticles($where: ArticleListWhere) {
      articles {
        listArticles(where: $where) {
          error {
            code
            message
            data
          }
          data {
            id
            slug
            googleDocs
            docIDs
            availableLocales
            twitterTitle {
              values {
                value
              }
            }
            twitterDescription {
              values {
                value
              }
            }
            facebookTitle {
              values {
                value
              }
            }
            facebookDescription {
              values {
                value
              }
            }
            searchTitle {
              values {
                value
              }
            }
            searchDescription {
              values {
                value
              }
            }
            headline {
              values {
                value
              }
            }
            content {
              values {
                value
              }
            }
          }
        }
      }
    }`,
    variables: {
      where: {
        docIDs_contains: documentID,
      }
    }
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
  var returnValue = {
    status: "",
    message: ""
  };

  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.listArticles && responseData.data.articles.listArticles.error === null && responseData.data.articles.listArticles.data && responseData.data.articles.listArticles.data[0] !== undefined) {
    var firstArticleData = responseData.data.articles.listArticles.data[0];
    returnValue.status = "success";
    returnValue.id = firstArticleData.id;
    returnValue.data = firstArticleData;
    returnValue.message = "Retrieved article with ID " +  returnValue.id;
  } else {
    returnValue.status = "error";
    if (responseData.data && responseData.data.articles && responseData.data.articles.listArticles && responseData.data.articles.listArticles.data && responseData.data.articles.listArticles.data.length !== 1) {
      var numberArticles = responseData.data.articles.listArticles.data.length;
      returnValue.message = "Found " + numberArticles + " matching articles and should be one";
    } else if (responseData.data && responseData.data.articles && responseData.data.articles.listArticles && responseData.data.articles.listArticles.error && responseData.data.articles.listArticles.error !== null) {
      returnValue.message = responseData.data.articles.listArticles.error;
    } else {
      returnValue.message = "Couldn't find an article for this Google Doc."
    }
  }
  return returnValue;
}

/*
. * Returns metadata about the article, including its id, whether it was published
. * headline and byline
. */
function getArticleMeta() {
  Logger.log("getArticleMeta START");

  var documentID = DocumentApp.getActiveDocument().getId();

  var articleID = getArticleID();

  // if there's no stored articleID on this document, try to find it by google document ID in webiny
  if (articleID === null) {
    Logger.log("No articleID found; looking up documentID", documentID, "in webiny now");
    var existingArticleData = getArticleByDocumentID(documentID);
    if (existingArticleData && existingArticleData.status === "success") {
      Logger.log("found article with this documentID: ", existingArticleData.id);

      articleID = existingArticleData.id;
      storeArticleID(existingArticleData.id);

      var headline = getDocumentName();
      Logger.log("headline:", headline);
      storeHeadline(headline);

      var googleDocs = existingArticleData.data.googleDocs;
      var googleDocsInfo = {};
      if (googleDocs) {
        try {
          googleDocsInfo = JSON.parse(googleDocs);
          Logger.log("googleDocs:", googleDocsInfo);

          var locale = Object.keys(googleDocsInfo).find(key => googleDocsInfo[key] === documentID);
          if (locale) {
            Logger.log("found locale NAME for this doc:", locale);
            storeSelectedLocaleName(locale);
            var locales = getLocales();
            var selectedLocaleID = null;
            var selectedLocale = locales.find((l) => l.code === locale);
            Logger.log("found localeID for this doc:", selectedLocale.id);
            storeLocaleID(selectedLocale.id);
          }

        } catch(e) {
          Logger.log("failed parsing googleDocs:", e);
        }
      }
    } else {
      Logger.log("error finding article with this documentID:", existingArticleData.message);
    }
  }

  // first determine if the document is an article or a static page for the site
  // this is based on which folder the document is in: 'pages' (static pages) or anything else (articles)
  // in order to do this we need to use the Google Drive API
  // which requires the "https://www.googleapis.com/auth/drive.readonly" scope
  var driveFile = DriveApp.getFileById(documentID)
  var fileParents = driveFile.getParents();
  var isStaticPage = false;
  while ( fileParents.hasNext() ) {
    var folder = fileParents.next();
    if (folder.getName() === "pages") {
      isStaticPage = true;
    }
  }
  var authorSlugsValue;
  var authorSlugs = [];

  var documentType = 'article';
  if (isStaticPage) {
    documentType = 'page';
  }
  storeDocumentType(documentType);

  var locales = getLocales();
  var selectedLocaleID = getLocaleID();
  var selectedLocaleName = null;
  if (selectedLocaleID) {
    var selectedLocale = locales.find((locale) => locale.id === selectedLocaleID);
    if (selectedLocale) {
      selectedLocaleName = selectedLocale.code;
      storeSelectedLocaleName(selectedLocaleName);
    }
  }

  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }

  var slug = getArticleSlug();
  if (slug === null || slug === undefined || slug.match(/^\s+$/) || slug === '') {
    Logger.log("NULL SLUG:", headline);
    slug = slugify(headline);
    storeArticleSlug(slug);
  } else {
    Logger.log("SLUG FOUND:", slug);
  }

  var googleDocsInfo = {};
  if (articleID !== null && articleID !== undefined) {
    var latestArticle = getArticleDataByID(articleID);

    if (latestArticle && latestArticle.status === "success") {
      var latestArticleData = latestArticle.data;
      Logger.log("getArticleMeta found latestArticleData")
      if (latestArticleData.published !== undefined) {
        Logger.log("getArticleMeta setting published to latestArticleData.published:", typeof(latestArticleData.published), latestArticleData.published);
        storeIsPublished(latestArticleData.published);
      }

      if (latestArticleData.googleDocs) {
        try {
          googleDocsInfo = JSON.parse(latestArticleData.googleDocs);
        } catch(e) {
          Logger.log("error parsing googleDocs json:", e);
        }
      }

      if (latestArticleData.headline && latestArticleData.headline.values && latestArticleData.headline.values[0].value) {
        storeHeadline(latestArticleData.headline.values[0].value);
      }
      if (latestArticleData.customByline) {
        storeCustomByline(latestArticleData.customByline);
      }

      if (latestArticleData.availableLocales) {
        storeAvailableLocales(latestArticleData.availableLocales);
      }
      if (latestArticleData.authors) {
        latestArticleData.authors.forEach(author => {
            authorSlugs.push(author.slug);
        });
        if (authorSlugs.length > 0) {
          authorSlugsValue = authorSlugs.join(' ');
          storeAuthorSlugs(authorSlugsValue);
        }
      }
      if (latestArticleData.category) {
        storeCategoryID(latestArticleData.category.id);
      }
      if (latestArticleData.tags) {
        storeTags(latestArticleData.tags);
      }
      if (latestArticleData.slug) {
        storeArticleSlug(latestArticleData.slug);
      }

      var seoData = {}
      if (latestArticleData.searchTitle && latestArticleData.searchTitle.values && latestArticleData.searchTitle.values[0] && latestArticleData.searchTitle.values[0].value) {
        seoData.searchTitle = latestArticleData.searchTitle.values[0].value;
      }
      if (latestArticleData.searchDescription && latestArticleData.searchDescription.values && latestArticleData.searchDescription.values[0] && latestArticleData.searchDescription.values[0].value) {
        seoData.searchDescription = latestArticleData.searchDescription.values[0].value;
      }
      if (latestArticleData.facebookTitle && latestArticleData.facebookTitle.values && latestArticleData.facebookTitle.values[0] && latestArticleData.facebookTitle.values[0].value) {
        seoData.facebookTitle = latestArticleData.facebookTitle.values[0].value;
      }
      if (latestArticleData.facebookDescription && latestArticleData.facebookDescription.values && latestArticleData.facebookDescription.values[0] && latestArticleData.facebookDescription.values[0].value) {
        seoData.facebookDescription = latestArticleData.facebookDescription.values[0].value;
      }
      if (latestArticleData.twitterTitle && latestArticleData.twitterTitle.values && latestArticleData.twitterTitle.values[0] && latestArticleData.twitterTitle.values[0].value) {
        seoData.twitterTitle = latestArticleData.twitterTitle.values[0].value;
      }
      if (latestArticleData.twitterDescription && latestArticleData.twitterDescription.values && latestArticleData.twitterDescription.values[0] && latestArticleData.twitterDescription.values[0].value) {
        seoData.twitterDescription = latestArticleData.twitterDescription.values[0].value;
      }

      if (Object.values(seoData).length > 0) {
        storeSEO(seoData);
      }
    } else {
      Logger.log("getArticleMeta failed finding latestArticle: ", latestArticle)
    }
  }

  var published = getIsPublished()
  Logger.log("getArticleMeta published:", typeof(published), published);
  // obviously it isn't published if we don't have a webiny article ID
  if (articleID === null || articleID === undefined) {
    published = false;
  }
  var publishingInfo = getPublishingInfo();

  var customByline = getCustomByline();

  var articleAuthors = getAuthors();
  var allAuthors = loadAuthorsFromDB();
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

  var categories = listCategories();
  storeCategories(categories);

  var categoryID = getCategoryID();
  var categoryName = getNameForCategoryID(categories, categoryID);

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

  var availableLocales = getAvailableLocales();
  Logger.log("availableLocales:", availableLocales);
  
  if (typeof(articleID) === "undefined" || articleID === null) {

    Logger.log("returning articleMetadata published:", typeof(published), published);
    return {
      accessToken: accessToken,
      allAuthors: allAuthors,
      allTags: allTags,
      articleAuthors: articleAuthors,
      articleID: null,
      articleTags: articleTags,
      authorSlugs: authorSlugsValue,
      awsAccessKey: awsAccessKey,
      awsSecretKey: awsSecretKey,
      awsBucket: awsBucket,
      availableLocales: null,
      categories: categories,
      categoryID: categoryID,
      categoryName: categoryName,
      contentApi: contentApi,
      customByline: customByline,
      documentType: documentType,
      headline: headline,
      localeID: null,
      localeName: null,
      locales: locales,
      previewSecret: previewSecret,
      previewUrl: previewUrl,
      published: published,
      publishingInfo: publishingInfo,
      seo: seoData,
      slug: slug,
      republishUrl: republishUrl
    }
  }

  var articleMetadata = {
    accessToken: accessToken,
    allAuthors: allAuthors,
    allTags: allTags,
    articleAuthors: articleAuthors,
    articleID: articleID,
    articleTags: articleTags,
    authorSlugs: authorSlugsValue,
    awsAccessKey: awsAccessKey,
    awsSecretKey: awsSecretKey,
    awsBucket: awsBucket,
    availableLocales: availableLocales,
    googleDocs: googleDocsInfo,
    categories: categories,
    categoryID: categoryID,
    categoryName: categoryName,
    contentApi: contentApi,
    customByline: customByline,
    documentType: documentType,
    localeID: selectedLocaleID,
    localeName: selectedLocaleName,
    locales: locales,
    previewUrl: previewUrl,
    previewSecret: previewSecret,
    headline: headline,
    published: published,
    publishingInfo: publishingInfo,
    slug: slug,
    seo: seoData,
    republishUrl: republishUrl
  };

  Logger.log("getArticleMeta END, published:", typeof(articleMetadata.published), articleMetadata.published);
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
  var response = getCurrentDocContents(formObject, true);
  Logger.log("END handlePublish: ", response)

  var metadata = getArticleMeta();
  response.data = metadata;
  return response;
}

/**
 * 
 * Saves the article as a draft, opens preview
 * @param {} formObject 
 */
function handlePreview(formObject) {
  Logger.log("START handlePreview:", formObject);
  // save the article - pass publishFlag as false
  var response = getCurrentDocContents(formObject, false);

  if (response && response.status === "success") {
    // construct preview url
    var slug = getArticleSlug();
    var scriptConfig = getScriptConfig();
    var previewHost = scriptConfig['PREVIEW_URL'];
    var previewSecret = scriptConfig['PREVIEW_SECRET'];
    var fullPreviewUrl = previewHost + "?secret=" + previewSecret + "&slug=" + slug;

    // open preview url in new window
    response.message += "<br><a href='" + fullPreviewUrl + "' target='_blank'>Preview article in new window</a>"

    Logger.log("END handlePreview: ", response)
  }
  var metadata = getArticleMeta();
  response.data = metadata;
  return response;
}

/**
. * Gets the current document's contents and
.  * posts them to webiny
. */
function getCurrentDocContents(formObject, publishFlag) {

  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = activeDoc.getId();

  var returnValue = {
    status: "",
    message: ""
  };

  processForm(formObject);

  var articleID = getArticleID();
  var documentType = getDocumentType();

  var title = getHeadline();

  var formattedElements = formatElements();

  var articleData = {};
  articleData.id = articleID;
  articleData.documentID = documentID;
  articleData.headline = title;
  articleData.formattedElements = formattedElements;

  var selectedLocale = getLocaleID();
  var selectedLocaleName = getSelectedLocaleName();
  // if no locale was selected, refuse to try publishing the article
  if (selectedLocale === null || selectedLocale === undefined) {
    Logger.log("FAILED FINDING A LOCALE FOR THIS ARTICLE, ERROR");
    returnValue.status = "error";
    returnValue.message = "Please select a locale for this content."
    return returnValue;
  }

  articleData.localeName = selectedLocaleName;
  articleData.localeID = selectedLocale;

  Logger.log("articleData for locale:", articleData.localeID, articleData.localeName);

  articleData.published = publishFlag;
  articleData.categoryID = getCategoryID();
  articleData.authors = getAuthors();
  articleData.tags = getTags();

  if (documentType === "article" && articleData.categoryID !== null) {
    storeCategoryID(articleData.categoryID);
  }

  Logger.log("articleData:", articleData);

  // first save the latest article content - either create a new article, or create a new revision on an existing article
  var responseData;
  // if we already have an articleID and latest version info, we need to create a new version of the article
  if (articleID !== null) {
    if (documentType === "article") {
      Logger.log("updating article id#", articleID)
      responseData = createArticleFrom(articleData);
    } else {
      Logger.log("updating page id#", articleID)
      responseData = createPageFrom(articleData);
    }
  // otherwise, we create a new article
  } else {
    if (documentType === "article") {
      Logger.log("creating new article")
      responseData = createArticle(articleData);
    } else {
      Logger.log("creating new page")
      responseData = createPage(articleData);
      // title, formattedElements);
    }

    if (responseData && responseData.status === "success" && responseData.id) {
      var articleID = responseData.id;
      storeArticleID(articleID);
    }
  }

  Logger.log("responseData:", responseData);

  if (responseData === null) {
    returnValue.status = "error";
    returnValue.message = "An unknown error occurred, contact your administrator.";
    return returnValue;
  }

  if (responseData.status !== "success") {
    returnValue.status = "error";
    returnValue.message = responseData.message;
    return returnValue;
  }

  responseText = `Successfully stored ${documentType} in webiny.`;

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
    // // hit vercel deploy hook to republish the site
    // var rebuildResponse = rebuildSite();
    // // Logger.log(`Posted to deploy hook to rebuild: `, rebuildResponse);
    // responseText += "<br>Rebuilding site on vercel";
    // responseText += "<br>" + JSON.stringify(rebuildResponse);

  } else {
    storeIsPublished(false);
  }

  // // update published flag and latest version ID
  // setArticleMeta();

  returnValue.status = "success";
  returnValue.message = responseText;
  return returnValue;
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

  var listInfo = {};
  var listItems = activeDoc.getListItems();
  listItems.forEach(li => {
    var id = li.getListId();
    var glyphType = li.getGlyphType();
    listInfo[id] = glyphType;
  })

  var foundMainImage = false;

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

            var imageID = subElement.inlineObjectElement.inlineObjectId;
            eleData.type = "image";

            // treat the first image as the main article image used in featured links
            if (!foundMainImage) {
              // Logger.log("treating this image as the main image:", imageID)
              eleData.type = "mainImage";
              foundMainImage = true;
            // } else {
            //   Logger.log("treating this image as a regular image:", imageID)
            }

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
function createPageFrom(articleData) {
  Logger.log("createPageFrom data: ", articleData);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var versionID = articleData.id;
  var title = articleData.headline;
  var elements = articleData.formattedElements;
  var localeID = articleData.localeID;

  var seoData = getSEO();

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = slugify(title);
    storeArticleSlug(slug);
  }

  var articleContent = JSON.stringify(elements);

  // grab current article contents
  var previousData = getPage(versionID);

  var headlineValues = i18nSetValues(title, localeID, previousData.headline.values);
  var contentValues = i18nSetValues(articleContent, localeID, previousData.content.values);
  var searchTitleValues = i18nSetValues(seoData.searchTitle, localeID, previousData.searchTitle.values);
  var searchDescriptionValues = i18nSetValues(seoData.searchDescription, localeID, previousData.searchDescription.values);
  var facebookTitleValues = i18nSetValues(seoData.facebookTitle, localeID, previousData.facebookTitle.values);
  var facebookDescriptionValues = i18nSetValues(seoData.facebookDescription, localeID, previousData.facebookDescription.values);
  var twitterTitleValues = i18nSetValues(seoData.twitterTitle, localeID, previousData.twitterTitle.values);
  var twitterDescriptionValues = i18nSetValues(seoData.twitterDescription, localeID, previousData.twitterDescription.values);

  var data = {
    slug: slug,
    headline: { values: headlineValues },
    content: { values: contentValues },
    searchTitle: { values: searchTitleValues },
    searchDescription: { values: searchDescriptionValues },
    facebookTitle: {values: facebookTitleValues},
    facebookDescription: {values: facebookDescriptionValues},
    twitterTitle: {values: twitterTitleValues},
    twitterDescription: {values: twitterDescriptionValues},
  }

  Logger.log("data (String):", JSON.stringify(data));

  var formData = {
    query: `mutation UpdatePage($id: ID!, $data: PageInput!) {
      pages { 
        updatePage(id: $id, data: $data) {
          error {
            code
            message
          }
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
      id: versionID,
      data: data
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
  Logger.log("createPageFrom responseData:", responseData);
  // var latestVersionID = responseData.data.content.data.id;
  // storeArticleID(latestVersionID);
  var returnValue = {
    status: "",
    message: ""
  };
  if (responseData && responseData.data && responseData.data.pages && responseData.data.pages.updatePage && responseData.data.pages.updatePage.error === null) {
    Logger.log("FOUND NO ERROR in UPDATE PAGE")
    returnValue.status = "success";
    returnValue.id = responseData.data.pages.updatePage.data.id;
    returnValue.message = "Updated page with ID " +  returnValue.id;
  } else if (responseData && responseData.data && responseData.data.pages && responseData.data.pages.updatePage && responseData.data.pages.updatePage.error !== null) {
    Logger.log("ERROR in UPDATE PAGE", responseData.data.pages.updatePage.error)
    returnValue.status = "error";
    returnValue.message = responseData.data.pages.updatePage.error;
  } else {
    Logger.log("wtf?", responseData.data);
  }

  return returnValue;
}

/**
 * Updates the article; formerly called a mutation called CreateArticleFrom, hence the strange name
 * @param versionID
 * @param title
 * @param elements
 */
function createArticleFrom(articleData) {
  Logger.log("createArticleFrom data.published: ", articleData.published);

  var returnValue = {
    status: "",
    message: ""
  };

  var localeID = articleData.localeID;
  if (localeID === null || localeID === undefined) {
    returnValue.status = "error";
    returnValue.message = "Missing required localeID!";
    return returnValue;
  }

  var versionID = articleData.id;
  var title = articleData.headline;
  var elements = articleData.formattedElements;

  var localeName = articleData.localeName;
  var articleAuthors = articleData.authors;
  var articleTags = articleData.tags; // only id
  var categoryID = articleData.categoryID;

  var articleContent = JSON.stringify(elements);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var customByline = getCustomByline();

  var publishingInfo = getPublishingInfo();

  var seoData = getSEO();

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  // var articleAuthors = getAuthors(); // only id

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

  // create any new tags
  const newTags = articleTags.filter(articleTag => articleTag.newTag === true);
  if (newTags.length > 0) {
    newTags.forEach(newTag => {
      createTag(newTag.title);
    })
  }

  var allTags = getAllTags(); // don't look up in the DB again, too slow

  var articleTags = getTags(); // refresh list of tags for this article as some may have been created just above
  // compare all tags array to those selected for this article
  var tagIDs = [];
  allTags.forEach(tag => {
    const result = articleTags.find( ({ id }) => id === tag.id );
    if (result !== undefined) {
      // Logger.log("found tag: ", tag);
      tagIDs.push(tag.id);
    }
  });

  // err on the safe side and default this flag to false
  var published = false;
  if (articleData !== undefined && articleData.published !== undefined && articleData.published !== null) {
    published = articleData.published;
  }
  Logger.log("createArticleFrom setting published to:", published);
  storeIsPublished(published);

  var categoryName = getNameForCategoryID(categories, categoryID);
  var slug = getArticleSlug();
  if (!articleData.published) {
    slug = createArticleSlug(categoryName, title);
    storeArticleSlug(slug);
  }

  // grab current article contents
  var previousArticleData = getArticle(versionID);
  if (!previousArticleData) {
    Logger.log("NO previous article data for:", versionID);
  }

  var availableLocaleNames = i18nGetLocales(localeID, previousArticleData.headline.values);

  // then merge in the new content with previous locale data
  var headlineValues = i18nSetValues(title, localeID, previousArticleData.headline.values);
  var contentValues = i18nSetValues(articleContent, localeID, previousArticleData.content.values);
  var searchTitleValues = i18nSetValues(seoData.searchTitle, localeID, previousArticleData.searchTitle.values);
  var searchDescriptionValues = i18nSetValues(seoData.searchDescription, localeID, previousArticleData.searchDescription.values);
  var facebookTitleValues = i18nSetValues(seoData.facebookTitle, localeID, previousArticleData.facebookTitle.values);
  var facebookDescriptionValues = i18nSetValues(seoData.facebookDescription, localeID, previousArticleData.facebookDescription.values);
  var twitterTitleValues = i18nSetValues(seoData.twitterTitle, localeID, previousArticleData.twitterTitle.values);
  var twitterDescriptionValues = i18nSetValues(seoData.twitterDescription, localeID, previousArticleData.twitterDescription.values);

  var updatedGoogleDocs = {};

  var previousGoogleDocs = null;
  if (articleData.googleDocs !== null) {
    previousGoogleDocs = articleData.googleDocs;
  } else if (previousArticleData.googleDocs !== null) {
    previousGoogleDocs = previousArticleData.googleDocs;

  }
  if (previousGoogleDocs && previousGoogleDocs !== null) {
    Logger.log("found prior googleDocs:", previousGoogleDocs);

    var priorGoogleDocsParsed = JSON.parse(previousGoogleDocs);
    if (priorGoogleDocsParsed[localeName]) {
      Logger.log("found prior googleDocs for locale!", localeName, priorGoogleDocsParsed[localeName])
    } else {
      Logger.log("NO prior googleDocs for locale:", localeName)
    }
    priorGoogleDocsParsed[localeName] = articleData.documentID;
    updatedGoogleDocs = priorGoogleDocsParsed;
  } else {
    updatedGoogleDocs[localeName] = articleData.documentID;
    Logger.log("no prior article data, creating google docs info now:", updatedGoogleDocs)
  }
  Logger.log("updatedGoogleDocs:", updatedGoogleDocs);

  var documentIDsForArticle = Object.values(updatedGoogleDocs);
  var documentIDsForArticleString = documentIDsForArticle.join(' ');
  Logger.log("storing docIDs:", documentIDsForArticleString)

  var data = {
    availableLocales: availableLocaleNames,
    googleDocs: JSON.stringify(updatedGoogleDocs),
    docIDs: documentIDsForArticleString,
    published: published,
    category: categoryID,
    customByline: customByline,
    authors: authorIDs,
    authorSlugs: authorSlugsValue,
    tags: tagIDs,
    headline: { values: headlineValues },
    headlineSearch: title,
    content: { values: contentValues },
    searchTitle: { values: searchTitleValues },
    searchDescription: { values: searchDescriptionValues },
    facebookTitle: {values: facebookTitleValues},
    facebookDescription: {values: facebookDescriptionValues},
    twitterTitle: {values: twitterTitleValues},
    twitterDescription: {values: twitterDescriptionValues},
  };

  // only update or set these if we're publishing the article
  if (published) {
    data.firstPublishedOn = publishingInfo.firstPublishedOn;
    data.lastPublishedOn = publishingInfo.lastPublishedOn;
  }
  // update the slug on unpublished articles
  if (!published) {
    data.slug = slug;
  }

  // Logger.log("tagIDs: ", tagIDs);
  var variables = {
    id: versionID,
    data:  data
  };
  // Logger.log("variables:", variables);

  var formData = {
    query: `mutation UpdateArticle($id: ID!, $data: ArticleInput!) {
      articles { 
        updateArticle(id: $id, data: $data) {
          error {
            code
            data
            message
          }
          data {
            id
            headline {
              values {
                value
              }
            }
            searchTitle {
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
  var responseData = JSON.parse(responseText);

  if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.updateArticle && responseData.data.articles.updateArticle.error === null) {
    returnValue.status = "success";
    returnValue.id = responseData.data.articles.updateArticle.data.id;
    returnValue.message = "Updated article with ID " +  returnValue.id;
  } else if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.updateArticle && responseData.data.articles.updateArticle.error !== null) {
    returnValue.status = "error";
    returnValue.message = responseData.data.articles.updateArticle.error;
    Logger.log(JSON.stringify(returnValue.message));
  }

  return returnValue;
}

/**
. * Posts document contents to graphql, creating a new page
. */
function createPage(articleData) {
  var title = articleData.title;
  var elements = articleData.formattedElements;
  var localeID = articleData.localeID;

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var seoData = getSEO();

  var slug = getArticleSlug();
  Logger.log("SLUG:", slug);

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

  var returnValue = {
    status: "",
    message: ""
  };
  if (responseData && responseData.data && responseData.data.pages && responseData.data.pages.createPage && responseData.data.pages.createPage.error !== null) {
    returnValue.status = "error";
    returnValue.id = null;
    returnValue.message = responseData.data.pages.createPage.error;
  } else {
    returnValue.message = "Created page with ID " +  returnValue.id;
    returnValue.status = "success";
    returnValue.id = responseData.data.pages.createPage.data.id;

  }
  return returnValue;
}

/**
. * Posts document contents to graphql, creating a new article
. */
function createArticle(articleData) {
  var title = articleData.headline;
  var elements = articleData.formattedElements;
  var localeID = articleData.localeID;
  var localeName = articleData.localeName;
  var articleAuthors = articleData.authors;
  var articleTags = articleData.tags; // only id
  var categoryID = articleData.categoryID;

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var customByline = getCustomByline();

  var publishingInfo = getPublishingInfo();
  var seoData = getSEO();

  var categories = getCategories();
  if (categories === null || categories.length <= 0) {
    categories = listCategories();
    storeCategories(categories);
  }

  storeAvailableLocales(localeName);

  var googleDocs = {};
  googleDocs[localeName] = articleData.documentID;

  var categoryName = getNameForCategoryID(categories, categoryID);

  var slug = getArticleSlug();
  if (slug === null || typeof(slug) === "undefined") {
    slug = createArticleSlug(categoryName, title);
    storeArticleSlug(slug);
  }

  var allAuthors = getAllAuthors(); // don't request from the DB again - too slow

  let authorSlugsValue;

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

  var queryString = `mutation CreateArticle($data: ArticleInput!) {
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
    }`;
  var gqlVariables = {
      data: {
        availableLocales: localeName,
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
        published: articleData.published,
        firstPublishedOn: publishingInfo.firstPublishedOn,
        lastPublishedOn: publishingInfo.lastPublishedOn,
        googleDocs: JSON.stringify(googleDocs)
      }
  };
  var formData = {
    query: queryString,
    variables: gqlVariables
  };

  Logger.log("vars: ", gqlVariables);
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

  var returnValue = {
    status: "",
    message: ""
  };
  if (responseData && responseData.data && responseData.data.articles && responseData.data.articles.createArticle && responseData.data.articles.createArticle.error !== null) {
    returnValue.status = "error";
    returnValue.id = null;
    returnValue.message = responseData.data.articles.createArticle.error;
  } else {
    returnValue.message = "Created article with ID " +  returnValue.id;
    returnValue.status = "success";
    returnValue.id = responseData.data.articles.createArticle.data.id;

  }
  return returnValue;
}

/**
 * Deletes the page
 */
function deletePage() {
  var versionID = getArticleID();
  Logger.log("versionID:", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `mutation DeletePage($id: ID!) {
      pages {
        deletePage(id: $id) {
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
  Logger.log(responseData);

  storeIsPublished(false);
  deleteSEO();
  deleteArticleSlug();
  deleteArticleID();
  deletePublishingInfo();
  // deleteTags();
  // deleteCategories();
  if (responseData && responseData.data && responseData.data.pages.deletePage.error === null) {
    return "Deleted article at revision " + versionID;
  } else if (responseData && responseData.data && responseData.data.pages.deletePage.error !== null) {
    return responseData.data.pages.deletePage.error;
  }
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
  Logger.log(responseData);

  storeIsPublished(false);
  deleteArticleSlug();
  deleteArticleID();
  deletePublishingInfo();
  deleteSEO();
  deleteTags();
  deleteCategories();
  if (responseData && responseData.data && responseData.data.articles.deleteArticle.error === null) {
    return "Deleted article at revision " + versionID;
  } else if (responseData && responseData.data && responseData.data.articles.deleteArticle.error !== null) {
    return responseData.data.articles.deleteArticle.error;
  }
}

/* This function clears out the google doc properties (articleID, anything stored) without expecting
 * access to a webiny API
 * it's useful if we have to relaunch the API and reconfigure the add-on in the event of an API failure
 */
function clearCache() {
  storeIsPublished(false);
  deleteArticleSlug();
  deleteArticleID();
  deletePublishingInfo();
  deleteSEO();
  deleteTags();
  deleteCategories();
  return "Cleared cache";
}

function publishPage() {
  Logger.log("START publishPage");
  var versionID = getArticleID();
  // Logger.log("publishing article versionID: ", versionID);

  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var publishingInfo = getPublishingInfo();
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
  Logger.log("publish page responseData:", responseData);

  Logger.log("END publishPage");
  if (responseData && responseData.data && responseData.data.pages && responseData.data.pages.updatePage && responseData.data.pages.updatePage.data) {
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

  var publishingInfo = getPublishingInfo();
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
    storeIsPublished(true);
    return "Published article at revision " + versionID;
  } else {
    storeIsPublished(false);
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

function getPage(id) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `query GetPage($id: ID!) {
      pages {
        getPage(id: $id) {
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
            slug
    
          }
        }
      }
    }`,
    variables: {
      id: id,
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
  return responseData.data.pages.getPage.data;
}

function getArticle(id) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  var formData = {
    query: `query GetArticle($id: ID!) {
      articles {
        getArticle(id: $id) {
          error {
            message
            code
            data
          }
          data {
            id
            googleDocs
            availableLocales
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
      id: id,
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
  return responseData.data.articles.getArticle.data;
}

function setArticleMeta() {
  Logger.log("START setArticleMeta")
  var articleID = getArticleID();

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

  var articleData = getArticle(articleID);
  var articleID = articleData.id;

  // store publishing info like first & last dates published, latest version ID and whether or not it's been published
  var publishingInfo = {};
  publishingInfo.firstPublishedOn = articleData.firstPublishedOn;
  publishingInfo.lastPublishedOn = articleData.lastPublishedOn;
  publishingInfo.publishedOn = articleData.lastPublishedOn;

  var tagsData = articleData.tags;
  var tagIDs = [];
  tagsData.forEach(tagData => {
    tagIDs.push(tagData.id)
  });
  var uniqueTags = tagIDs.filter(onlyUnique);
  storeTags(uniqueTags);

  Logger.log("END setArticleMeta")
  return articleData;
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

  if (formObject["article-locale"] && formObject["article-locale"] !== null && formObject["article-locale"] !== undefined) {
    var selectedLocale  = formObject["article-locale"];
    if (selectedLocale !== null) {
      storeLocaleID(selectedLocale);
    }
  }

  // get the current locale code; if it's not stored already, store it
  var selectedLocaleName = getSelectedLocaleName();
  if (selectedLocaleName === null || selectedLocaleName === undefined || selectedLocaleName === "") {
    Logger.log("processForm selectedLocaleName is null");
    var locales = getLocales();
    var selectedLocaleID = getLocaleID();
    if (selectedLocaleID) {
      Logger.log("processForm selectedLocaleName is null, got localeID", selectedLocaleID);
      var selectedLocale = locales.find((locale) => locale.id === selectedLocaleID);
      if (selectedLocale) {
        Logger.log("processForm selectedLocaleName is null, found locale", selectedLocale);
        selectedLocaleName = selectedLocale.code;
        Logger.log("processForm selectedLocaleName is null, code:", selectedLocaleName);
        storeSelectedLocaleName(selectedLocaleName);
      } else {
        Logger.log("processForm failed finding selected locale")
      }
    } else {
      Logger.log("processForm failed finding selected locale ID in props")
    }
  } else {
    Logger.log("processForm selected locale name FOUND:", selectedLocaleName)
  }

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
    if (categoryID !== undefined) {
      storeCategoryID(categoryID);
    }
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

/*
.* called from ManualPage.html, this function searches for a matching article by headline
.*/
function handleSearch(formObject) {
  var scriptConfig = getScriptConfig();
  var ACCESS_TOKEN = scriptConfig['ACCESS_TOKEN'];
  var CONTENT_API = scriptConfig['CONTENT_API'];

  Logger.log("handleSearch:", formObject);
  var SEARCH_ARTICLES = `
    query SearchArticles($where: ArticleListWhere) {
      articles {
        listArticles(where: $where) {
          data {
            id
            headlineSearch
            firstPublishedOn
            slug
            headline {
              values {
                value
              }
            }
            content {
              values {
                value
              }
            }
            category {
              id
              title {
                values {
                  value
                }
              }
              slug
            }
            tags {
              id
              title{
                values {
                  value
                }
              }
              slug
            }
            authors {
              id
              name
            }
            authorSlugs
          }
        }
      }
    }`;
    var formData = {
      query: SEARCH_ARTICLES,
      variables: {
        where: {
          headline_contains: formObject['article-search'],
        },
      }
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
    var responseData = JSON.parse(responseText);
    Logger.log("handleSearch responseData:", responseData);
    var locales = getLocales();

    var searchResults = {
      locales: locales,
      articles: responseData.data.articles.listArticles.data
    }
    return searchResults;
}

/*
.* called from ManualPage.html, this function associates the google doc with the selected article
.*/
function associateArticle(formObject) {
  Logger.log("associateArticle:", formObject);

  var articleData = {};

  var articleID  = formObject["article-id"];
  articleData.id = articleID;

  var documentID = DocumentApp.getActiveDocument().getId();
  articleData.documentID = documentID;

  var localeID  = formObject["article-locale"];
  articleData.localeID = localeID;

  var locales = getLocales();
  var selectedLocale = locales.find((locale) => locale.id === localeID);
  if (selectedLocale) {
    storeSelectedLocaleName(selectedLocale.code);
    articleData.localeName = selectedLocale.code;
  }

  var headline = getHeadline();
  if (typeof(headline) === "undefined" || headline === null || headline.trim() === "") {
    headline = getDocumentName();
    storeHeadline(headline);
  }
  articleData.headline = headline;

  var formattedElements = formatElements();
  articleData.formattedElements = formattedElements;

  articleData.published = false;
  articleData.authors = getAuthors();
  articleData.tags = getTags();

  Logger.log("articleData:", articleData);
  var responseData = createArticleFrom(articleData);
  Logger.log("response:", responseData);

  if (responseData && responseData.status === "error") {
    Logger.log("ERROR:", responseData.message);
  } else {
    Logger.log("SUCCESS:", responseData.message);

    // finally store the articleID so we know whether to freshly associate the doc going forward.
    var articleID = responseData.id;
    storeArticleID(articleID);
  }

  return responseData;
}

function i18nGetLocales(currentLocaleID, exampleLocalisedValues) {

  var availableLocales = null;

  var localesAvailable = exampleLocalisedValues.map(value=>value.locale)
  Logger.log("locales found in headline:", localesAvailable);

  if (!localesAvailable.includes(currentLocaleID)) {
    localesAvailable.push(currentLocaleID);
  }

  var allLocales = getLocales();
  var localeNames = [];

  localesAvailable.forEach( (item, index) => {
    Logger.log("Looking for locale name for ID:", item);
    var selectedLocale = allLocales.find((locale) => locale.id === item);
    if (selectedLocale) {
      Logger.log("-found locale name:", selectedLocale.code);
      localeNames.push(selectedLocale.code);
    }
  });

  availableLocales = localeNames.join(" ");
  Logger.log("availableLocales:", availableLocales);
  storeAvailableLocales(availableLocales);

  return availableLocales;
}

function i18nSetValues(text, localeID, previousValues) {
  // don't bother appending blank values for this locale
  if (text === null || text === undefined || text === "") {
    return previousValues;
  }
  var newValues;
  if (previousValues && previousValues.length > 0) {
    var foundIt = false;
    newValues = previousValues.map( (obj) => {
      if (obj.locale === localeID) {
        foundIt = true;
        obj.value = text;
      }
      return obj;
    });
    // case handling when there was no search title set in this locale
    if (!foundIt) {
      newValues = previousValues;
      newValues.push({
        value: text,
        locale: localeID
      });
      Logger.log("NO prior in locale, appended", newValues.length, "values");
    }
  // case handling when there was NO previous value set in any language
  } else {
    newValues = [{
      value: text,
      locale: localeID
    }]
    Logger.log("NO prior in any locale, creating", newValues.length);
  }
  return newValues;
}

function createNewDoc(newLocale) {
  if (newLocale === null || typeof(newLocale) === "undefined") {
    return;
  }
  var localeName = cleanContent(newLocale);

  var currentHeadline = getHeadline();
  var newHeadline = currentHeadline + " (" + localeName + ")";

  var parentDocID = DocumentApp.getActiveDocument().getId();
  var parentArticleID = getArticleID();

  var docID;
  var driveFile = DriveApp.getFileById(parentDocID);
  var newFile = driveFile.makeCopy(newHeadline);
  Logger.log("created new doc:", newFile);
  if (newFile) {
    docID = newFile.getId();
  } else {
    Logger.log("failed creating new file via DriveApp")
    return null;
  }

  // setup the articleData
  var articleData = {};

  articleData.documentID = docID;
  articleData.id = parentArticleID;
  articleData.headline = newHeadline;
  articleData.formattedElements = formatElements();
  articleData.categoryID = getCategoryID();
  articleData.authors = getAuthors();
  articleData.tags = getTags();

  var locales = getLocales();
  Logger.log("looking up locale name:", localeName, ";; in locales:", locales);
  var selectedLocale = locales.find((locale) => locale.code === localeName);
  if (selectedLocale) {
    articleData.localeID = selectedLocale.id;
    articleData.localeName = selectedLocale.code;
  } else {
    Logger.log("FAILED finding locale ID")
    articleData.localeName = localeName;
  }

  // articleData.published
  articleData.published = false;

  var googleDocsInfo = {};
  if (parentArticleID !== null && parentArticleID !== undefined) {
    var latestArticle = getArticleDataByID(parentArticleID);

    if (latestArticle && latestArticle.status === "success") {
      var latestArticleData = latestArticle.data;
      Logger.log("createNewDoc found latestArticleData")
      if (latestArticleData.googleDocs) {
        try {
          googleDocsInfo = JSON.parse(latestArticleData.googleDocs);
        } catch(e) {
          Logger.log("error parsing googleDocs json:", e);
        }
      }
    } else {
      Logger.log("createNewDoc failed finding latest article data for", parentArticleID);
    }
  }
  // store the new document ID for this locale
  googleDocsInfo[localeName] = docID;
  Logger.log("createNewDoc googleDocsInfo:", googleDocsInfo);

  articleData.googleDocs = JSON.stringify(googleDocsInfo);

  // update the article for this document
  Logger.log("createNewDoc:", articleData.googleDocs, articleData.localeID, articleData.localeName, articleData.headline)
  responseData = createArticleFrom(articleData);

  if (responseData && responseData.status === "success" && responseData.id) {
    Logger.log("createNewDoc update success");
  } else {
    Logger.log("createNewDoc update FAIL:", responseData);
  }

  return {
    docID: docID,
    parentID: parentDocID,
    responseData: responseData
  };
}
