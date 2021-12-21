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
 * This adds a "TNC Tools" menu option.
 */
function onOpen(e) {
  // display sidebar
  DocumentApp.getUi()
    .createMenu('TinyCMS Publishing Tools')
    .addItem('Publishing Tools', 'showSidebar')
    .addItem('Administrator Tools', 'showSidebarManualAssociate')
    .addToUi();
}

/**
 * Displays the Publishing Tools sidebar
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Page')
    .setTitle('CMS Integration')
    .setWidth(300);
  DocumentApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showSidebar(html);
}

/**
 * Displays the Admin Tools sidebar
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
function uploadImageToS3(imageID, contentUri, slug) {
  var scriptConfig = getScriptConfig();
  var AWS_ACCESS_KEY_ID = scriptConfig['AWS_ACCESS_KEY_ID'];
  var AWS_SECRET_KEY = scriptConfig['AWS_SECRET_KEY'];
  var AWS_BUCKET = scriptConfig['AWS_BUCKET'];

  var orgName = getOrganizationName();
  var orgNameSlug = slugify(orgName);
  var articleSlug;
  
  if (slug) {
    articleSlug = slug;
  } else {
    articleSlug = getArticleSlug();
  }

  // Logger.log("uploading image for org " + orgNameSlug + "and article " + articleSlug);

  var objectName = "image" + imageID + ".png";

  // get the image data from google first
  var imageData = null;
  var googleAuthToken = ScriptApp.getOAuthToken();
  Logger.log("GOOGLE AUTH TOKEN: " + googleAuthToken);
  var res = UrlFetchApp.fetch(contentUri, {headers: {Authorization: "Bearer " + googleAuthToken}, muteHttpExceptions: true});
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
    s3.putObject(AWS_BUCKET, destinationPath, imageData, {logRequests:false});
  } catch (e) {
    Logger.log("Failed putting object: ", e)
  }
  var s3Url = "http://assets.tinynewsco.org/" + destinationPath;
  Logger.log("s3Url: " + s3Url)
  return s3Url;
}

/*
* looks up either an article or a page by google doc ID
*/
async function lookupDataForDocument(documentID, documentType) {
    var scriptConfig = getScriptConfig();
    var API_TOKEN = scriptConfig['DOCUMENT_API_TOKEN'];
    var API_URL = scriptConfig['DOCUMENT_API_URL'];
    var ORG_SLUG = scriptConfig['ACCESS_TOKEN'];
  
    var options = {
      method: 'GET',
      muteHttpExceptions: true,
      contentType: 'application/json',
    };
  
    const requestURL = `${API_URL}/api/sidebar/documents/${documentID}?token=${API_TOKEN}&documentType=${documentType}`
    Logger.log("REQUEST URL: " + requestURL);
    const result = await UrlFetchApp.fetch(
      requestURL,
      options
    );
  
    var responseText = result.getContentText();
    var responseData = JSON.parse(responseText);
  
    responseData.orgSlug = ORG_SLUG;
    Logger.log(Object.keys(responseData) + " " + responseData.documentType);
    return responseData;
  }
  
/*
.* Gets the script configuration, data available to all users and docs for this add-on
.*/
function getScriptConfig() {
  // look up org name on this document (scoped doc properties) in case we've figured it out before
  var orgName = getOrganizationName();

  // otherwise, locate the folder that contains 'articles' or 'pages' - it should be
  // named for the organisation; for example: 'oaklyn' > 'articles' > 'Article Document'
  if (orgName === null) {
    var documentID = DocumentApp.getActiveDocument().getId();
    var driveFile = DriveApp.getFileById(documentID)
    var fileParents = driveFile.getParents();
    while ( fileParents.hasNext() ) {
      var folder = fileParents.next();
      if (folder.getName() === 'articles' || folder.getName() === 'pages') {
        var folderParents = folder.getParents();
        while ( folderParents.hasNext() ) {
          var grandFolder = folderParents.next();
          orgName = grandFolder.getName();
          storeOrganizationName(orgName);
        }
      }
    }
  }

  // If there's still no org name return an error
  if (orgName === null) {
    return { "status": "error", "message": "Failed to find an organization name; check the folder structure." }
  }

  var scriptProperties = PropertiesService.getScriptProperties();
  var data = scriptProperties.getProperties();
  var orgData = {}
  var pattern = `^${orgName}_`;
  var orgKeyRegEx = new RegExp(pattern, "i")
    // value = value.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i));
  for (var key in data) {
    if (orgKeyRegEx.test(key)) {
      var plainKey = key.replace(orgKeyRegEx, '');
      orgData[plainKey] = data[key];
    }
  }
  return orgData;
}

/*
.* Sets script-wide configuration
.*/
function setScriptConfig(data) {
  var orgName = getOrganizationName();
  if (orgName === null) {
    return { "status": "error", "message": "Failed to find an organization name; check the folder structure." }
  }
  var scriptProperties = PropertiesService.getScriptProperties();
  for (var key in data) {
    var orgKey = orgName + "_" + key;
    // (orgKey, "=>", data[key]);
    scriptProperties.setProperty(orgKey, data[key]);
  }
  return { status: "success", message: "Saved configuration." };
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
  // Logger.log(`${key} => ${value}`);
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

function getOrganizationName() {
  return getValue("ORG_NAME");
}

function storeOrganizationName(value) {
  storeValue("ORG_NAME", value);
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

function storeImageList(slug, imageList) {
  var key = "IMAGE_LIST_" + slug;
  storeValue(key, JSON.stringify(imageList));
}

function getImageList(slug) {
  var key = "IMAGE_LIST_" + slug;
  var imageList = JSON.parse(getValue(key));
  if (imageList === null) {
    imageList = {};
  }
  return imageList;
}

async function fetchGraphQL(operationsDoc, operationName, variables) {
  var scriptConfig = getScriptConfig();
  var ORG_SLUG = scriptConfig['ACCESS_TOKEN'];
  var API_URL = scriptConfig['CONTENT_API'];

  var options = {
    method: 'POST',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      "TNC-Organization": ORG_SLUG
    },
    payload: JSON.stringify({
      query: operationsDoc,
      variables: variables,
      operationName: operationName
    }),
  };

  const result = await UrlFetchApp.fetch(
    API_URL,
    options
  );

  var responseText = result.getContentText();
  var responseData = JSON.parse(responseText);

  responseData.orgSlug = ORG_SLUG;
  Logger.log(Object.keys(responseData), responseData.orgSlug);
  return responseData;
}

function storeArticleIdAndSlug(id, slug, categorySlug) {
  return fetchGraphQL(
    insertArticleSlugVersion,
    "AddonInsertArticleSlugVersion",
    {
      article_id: id,
      slug: slug,
      category_slug: categorySlug
    }
  );
}

function storePageIdAndSlug(id, slug) {
  return fetchGraphQL(
    insertPageSlugVersion,
    "AddonInsertPageSlugVersion",
    {
      page_id: id,
      slug: slug
    }
  );
}

async function insertPageGoogleDocs(data) {
  var returnValue = {
    status: "success",
    message: "",
    data: {},
    documentType: "page"
  };

  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = DocumentApp.getActiveDocument().getId();
  var documentURL = DocumentApp.getActiveDocument().getUrl();

  if (data['document-id']) {
    documentID = data['document-id'];
    documentUrl = data['document-url'];  
  }

  var document = Docs.Documents.get(documentID);
  var slug = getArticleSlug();
  if (!slug) {
    slug = data['article-slug'];
  }
  var elements = document.body.content;
  var inlineObjects = document.inlineObjects;
  // used to track which images have already been uploaded
  var imageList = getImageList(slug);

  var listInfo = {};
  var listItems = activeDoc.getListItems();
  listItems.forEach(li => {
    var id = li.getListId();
    var glyphType = li.getGlyphType();
    listInfo[id] = glyphType;
  })

  let pageData = {
    "id": data['article-id'],
    "slug": slug,
    "document_id": documentID,
    "url": documentURL,
    "locale_code": data['article-locale'],
    "headline": data['article-headline'],
    "published": data['published'],
    "search_description": data['article-search-description'],
    "search_title": data['article-search-title'],
    "twitter_title": data['article-twitter-title'],
    "twitter_description": data['article-twitter-description'],
    "facebook_title": data['article-facebook-title'],
    "facebook_description": data['article-facebook-description'],
    "created_by_email": data['created_by_email'],
    "page_authors": data['article-authors'],
  };

  let response = await previewPage(pageData, slug, elements, listInfo, imageList, inlineObjects);
  Logger.log("previewPageResponse: " + Object.keys(response).sort());
  returnValue.data = response.data;

  if (response.status && response.status === 'error') {
    returnValue.status = 'error';
    returnValue.message = "An error occurred saving the page."
  } else {
    Logger.log("Storing image list.");
    storeImageList(slug, response.updatedImageList);  
    returnValue.previewUrl = response.previewUrl;
    returnValue.message = "Successfully saved the page.";
  }
  return returnValue;
}

function upsertPublishedArticle(articleId, translationId, localeCode) {
  return fetchGraphQL(
    upsertPublishedArticleTranslationMutation,
    "AddonUpsertPublishedArticleTranslation",
    {
      article_id: articleId,
      locale_code: localeCode,
      article_translation_id: translationId
    }
  );
}


async function findPageBySlug(slug, localeCode) {
  var documentID = DocumentApp.getActiveDocument().getId();

  return fetchGraphQL(
    findPageBySlugQuery,
    "AddonFindPageBySlug",
    {
      document_id: documentID,
      slug: slug,
      locale_code: localeCode,
    }
  );
}

async function findArticleByCategoryAndSlug(category_id, slug, localeCode) {
  var documentID = DocumentApp.getActiveDocument().getId();

  return fetchGraphQL(
    findArticleByCategoryAndSlugQuery,
    "AddonFindArticleByCategorySlug",
    {
      category_id: category_id,
      document_id: documentID,
      slug: slug,
      locale_code: localeCode,
    }
  );
}

async function insertArticleGoogleDocs(data) {
  var returnValue = {
    status: "success",
    message: "",
    data: {},
    documentType: "article"
  };

  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = activeDoc.getId();
  var documentUrl = DocumentApp.getActiveDocument().getUrl();

  if (data['document-id']) {
    documentID = data['document-id'];
    documentUrl = data['document-url'];  
  }

  var document = Docs.Documents.get(documentID);
  var slug = getArticleSlug();
  if (!slug) {
    slug = data['article-slug'];
  }
  var elements = document.body.content;
  var inlineObjects = document.inlineObjects;
  // used to track which images have already been uploaded
  var imageList = getImageList(slug);

  var listInfo = {};
  var listItems = activeDoc.getListItems();
  listItems.forEach(li => {
    var id = li.getListId();
    var glyphType = li.getGlyphType();
    listInfo[id] = glyphType;
  })

  let articleData = {
    "id": data['article-id'],
    "slug": slug,
    "document_id": documentID,
    "url": documentUrl,
    "category_id": data['article-category'],
    "locale_code": data['article-locale'],
    "headline": data['article-headline'],
    "published": data['published'],
    "search_description": data['article-search-description'],
    "search_title": data['article-search-title'],
    "twitter_title": data['article-twitter-title'],
    "twitter_description": data['article-twitter-description'],
    "facebook_title": data['article-facebook-title'],
    "facebook_description": data['article-facebook-description'],
    "custom_byline": data['article-custom-byline'],
    "created_by_email": data['created_by_email'],
    "canonical_url": data['article-custom-canonical-url'],
    "article_tags": data['article-tags'],
    "article_authors": data['article-authors'],
  };

  if (data["first-published-at"]) {
    articleData["first_published_at"] = data["first-published-at"];
    Logger.log("* first published at: " + articleData["first_published_at"]);
  } 

  var dataSources = [];
  if (data['sources'] !== {} && Object.keys(data['sources']).length > 0) {
    Object.keys(data['sources']).forEach(id => {
      Logger.log("id: " + typeof(id) + " -> " + id)
      var source = data['sources'][id];

      var sourceData = {
        name: source['name'],
        affiliation: source['affiliation'],
        race: source['race'],
        ethnicity: source['ethnicity'],
        age: source['age'],
        gender: source['gender'],
        phone: source['phone'],
        email: source['email'],
        zip: source['zip'],
        sexual_orientation: source['sexual_orientation'],
        role: source['role'],
      };

      if (id !== null && id !== undefined && id !== "" && !(/new_/.test(id))) {
        sourceData["id"] = parseInt(id);
      }

      dataSources.push({
        source: {
          data: sourceData,
          on_conflict: {
            constraint: "sources_pkey", 
            update_columns: ["name", "affiliation", "age", "phone", "zip", "race", "gender", "sexual_orientation", "ethnicity", "role", "email"]
          }
        }
      })
    })
    articleData["article_sources"] =  dataSources;
    Logger.log("pushed sources onto article data:" + JSON.stringify(articleData['article_sources']));
  } else {
    articleData['article_sources'] = [];
  }


  if (articleData['published']) {
    Logger.log("PUBLISH");
    let response = await apiSaveArticle(articleData, slug, elements, listInfo, imageList, inlineObjects);
    Logger.log("publishArticleResponse: " + Object.keys(response).sort());
    returnValue.data = response.data;
    
    if (response.status && response.status === 'error') {
      returnValue.status = 'error';
      returnValue.message = "An error occurred saving the article."
    } else {
      Logger.log("Storing image list.");
      storeImageList(slug, response.updatedImageList);  
      returnValue.publishUrl = response.publishUrl;
      returnValue.message = "Successfully saved the article.";
    }
  } else {
    Logger.log("PREVIEW");
    let response = await apiSaveArticle(articleData, slug, elements, listInfo, imageList, inlineObjects);
    Logger.log("previewArticleResponse: " + Object.keys(response).sort());
    returnValue.data = response.data;
    
    if (response.status && response.status === 'error') {
      returnValue.status = 'error';
      returnValue.message = "An error occurred saving the article."
    } else {
      Logger.log("Storing image list.");
      storeImageList(slug, response.updatedImageList);  
      returnValue.previewUrl = response.previewUrl;
      returnValue.message = "Successfully saved the article.";
    }
  
  }

  return returnValue;
}

async function hasuraCreateAuthorPage(authorId, pageId) {
  return fetchGraphQL(
    insertAuthorPageMutation,
    "AddonInsertAuthorPage",
    {
      page_id: pageId,
      author_id: authorId
    }
  );
}

async function hasuraDeleteTagArticles(articleId) {
  return fetchGraphQL(
    deleteTagArticlesMutation,
    "AddonDeleteTagArticles",
    {
      article_id: articleId
    }
  );
}

async function hasuraDeleteAuthorArticles(articleId) {
  return fetchGraphQL(
    deleteAuthorArticlesMutation,
    "AddonDeleteAuthorArticles",
    {
      article_id: articleId
    }
  );
}

async function hasuraCreateAuthorArticle(authorId, articleId) {
  return fetchGraphQL(
    insertAuthorArticleMutation,
    "AddonInsertAuthorArticle",
    {
      article_id: articleId,
      author_id: authorId
    }
  );
}

async function linkDocToArticle(data) {
  return fetchGraphQL(
    linkDocToArticleMutation,
    "AddonLinkGoogleDocToArticle",
    {
      article_id: data['article-id'],
      document_id: data['document-id'],
      locale_code: data['article-locale'],
      url: data['document-url']
    }
  );
}

async function hasuraInsertGoogleDoc(articleId, docId, localeCode, url) {
  return fetchGraphQL(
    insertGoogleDocMutation,
    "AddonInsertGoogleDoc",
    {
      article_id: articleId,
      document_id: docId,
      locale_code: localeCode,
      url: url
    }
  );
}

async function hasuraInsertPageGoogleDoc(pageId, docId, localeCode, url) {
  return fetchGraphQL(
    insertPageGoogleDocMutation,
    "AddonInsertPageGoogleDoc",
    {
      page_id: pageId,
      document_id: docId,
      locale_code: localeCode,
      url: url
    }
  );
}

async function hasuraDeleteArticle(articleId) {
  Logger.log("deleting article ID#" + articleId);
  return fetchGraphQL(
    deleteArticleMutation,
    "AddonDeleteArticleMutation",
    {
      article_id: articleId
    }
  )
}

async function hasuraCreateArticleDoc(articleId, newLocale, headline) {
  Logger.log("create new doc for article " + articleId + " and locale " + newLocale);
  // create new document in google docs
  var currentDocId = DocumentApp.getActiveDocument().getId();
  var newDocId;
  var newDocUrl;
  var localisedHeadline = newLocale + " - " + headline;
  var driveFile = DriveApp.getFileById(currentDocId);
  var newFile = driveFile.makeCopy(localisedHeadline);
  if (newFile) {
    newDocId = newFile.getId();
    newDocUrl = newFile.getUrl();
  } else {
    Logger.log("failed creating new file via DriveApp")
    return null;
  }

  // insert new document ID in google_documents table with newLocale & articleID
  var response = await hasuraInsertGoogleDoc(articleId, newDocId, newLocale, newDocUrl);
  Logger.log("hasura insert googleDoc response: " + JSON.stringify(response));

  // return new doc ID / url for link?

  return {
    articleId: articleId,
    locale: newLocale,
    docId: newDocId,
    url: newDocUrl,
    data: response
  }
}
async function hasuraCreatePageDoc(pageId, newLocale, headline) {
  Logger.log("create new doc for page " + pageId + " and locale " + newLocale);
  // create new document in google docs
  var currentDocId = DocumentApp.getActiveDocument().getId();
  var newDocId;
  var newDocUrl;
  var localisedHeadline = newLocale + " - " + headline;
  var driveFile = DriveApp.getFileById(currentDocId);
  var newFile = driveFile.makeCopy(localisedHeadline);
  if (newFile) {
    newDocId = newFile.getId();
    newDocUrl = newFile.getUrl();
  } else {
    Logger.log("failed creating new file via DriveApp")
    return null;
  }

  // insert new document ID in google_documents table with newLocale & articleID
  var response = await hasuraInsertPageGoogleDoc(pageId, newDocId, newLocale, newDocUrl);
  Logger.log("hasura insert page googleDoc response: " + JSON.stringify(response));

  // return new doc ID / url for link?

  return {
    pageId: pageId,
    locale: newLocale,
    docId: newDocId,
    url: newDocUrl,
    data: response
  }
}

async function hasuraAssociateArticle(formObject) {
  var currentDocument = DocumentApp.getActiveDocument();
  var documentId = currentDocument.getId();
  var documentUrl = currentDocument.getUrl();

  formObject['document-id'] = documentId;
  formObject['document-url'] = documentUrl;

  Logger.log("formObject: " + JSON.stringify(formObject));
  var data = await linkDocToArticle(formObject);
  Logger.log(data);
  var returnValue = {
    status: "success",
    message: "Successfully linked document to article",
    data: data
  };

  if (data && data.errors) {
    returnValue.message = data.errors[0].message;
    returnValue.status = "error";
  }
  return returnValue;
}

async function hasuraUnpublishArticle(articleId, localeCode) {

  return fetchGraphQL(
    unpublishArticleMutation,
    "AddonUnpublishArticle",
    {
      article_id: articleId,
      locale_code: localeCode
    }
  );
}

async function hasuraUnpublishPage(pageId, localeCode) {

  return fetchGraphQL(
    unpublishPageMutation,
    "AddonUnpublishPage",
    {
      page_id: pageId,
      locale_code: localeCode
    }
  );
}

async function hasuraCreateTag(tagData) {
  return fetchGraphQL(
    insertTagMutation,
    "AddonInsertTag",
    tagData
  );
}

async function hasuraHandleUnpublishPage(formObject) {
  var pageID = formObject['article-id'];
  var localeCode = formObject['article-locale'];
  var response = await hasuraUnpublishPage(pageID, localeCode);
  
  var returnValue = {
    status: "success",
    message: "Unpublished the page with id " + pageID + " in locale " + localeCode,
    data: response
  };
  if (response.errors) {
    returnValue.status = "error";
    returnValue.message = "An unexpected error occurred trying to unpublish the page";
    returnValue.data = response.errors;
  } else {
    // trigger republish of the site to reflect this page no longer being live
    rebuildSite();
  }
  return returnValue;
}

async function hasuraHandleUnpublish(formObject) {
  var articleID = formObject['article-id'];
  var localeCode = formObject['article-locale'];
  var response = await hasuraUnpublishArticle(articleID, localeCode);
  
  var returnValue = {
    status: "success",
    message: "Unpublished the article with id " + articleID + " in locale " + localeCode,
    data: response
  };
  if (response.errors) {
    returnValue.status = "error";
    returnValue.message = "An unexpected error occurred trying to unpublish the article";
    returnValue.data = response.errors;
  } else {
    // trigger republish of the site to reflect this article no longer being live
    rebuildSite();
  }
  return returnValue;
}


async function hasuraGetPublishedArticles(localeCode) {
  return fetchGraphQL(
    getPublishedArticles,
    "AddonGetPublishedArticles",
    {
      locale_code: localeCode
    }
  );  
}

async function republishArticles(localeCode) {
  if (localeCode === undefined || localeCode === null) {
    localeCode = "en-US" // TODO should we default this way?
  }
  var response = await hasuraGetPublishedArticles(localeCode);
  var returnValue = {
    status: "success",
    message: "Republishing all articles",
    data: response
  };

  var currentUserEmail = Session.getActiveUser().getEmail();

  var googleDocIDs = [];
  var results = [];
  if (response.errors) {
    returnValue.status = "error";
    returnValue.message = "An unexpected error occurred trying to republish all articles";
    returnValue.data = response.errors;
  } else {  
    response.data.articles.forEach(article => {
      
      var googleDocID = article.article_google_documents[0].google_document.document_id;
      googleDocIDs.push(googleDocID);

      var googleDocURL = article.article_google_documents[0].google_document.url;

      var id = article.id;
      var slug = article.slug;
      
      var activeDoc = DocumentApp.openById(googleDocID);
      // Logger.log("processing google doc ID#" + googleDocID);
      
      var document = Docs.Documents.get(googleDocID);
      
      processDocumentContents(activeDoc, document, slug).then(orderedElements => {
        // Logger.log(googleDocID +  " ordered elements:" + orderedElements.length);
        var formattedElements = formatElements(orderedElements);
        var mainImageContent = getMainImage(formattedElements);
        // Logger.log(googleDocID + " mainImageContent: " + JSON.stringify(mainImageContent));

        var categoryID = article.category.id;
        var translation = article.article_translations[0];

        var articleData = {
          "id": id,
          "slug": slug,
          "document_id": googleDocID,
          "url": googleDocURL,
          "category_id": categoryID,
          "locale_code": localeCode,
          "headline": translation.headline,
          "published": true,
          "content": formattedElements,
          "search_description": translation.search_description,
          "search_title": translation.search_title,
          "twitter_title": translation.twitter_title,
          "twitter_description": translation.twitter_description,
          "facebook_title": translation.facebook_title,
          "facebook_description": translation.facebook_description,
          "custom_byline": translation.custom_byline,
          "created_by_email": currentUserEmail,
          "main_image": mainImageContent,
        }
        // Logger.log(googleDocID + " articleData: " + JSON.stringify(articleData))
        fetchGraphQL(
          insertArticleGoogleDocMutationWithoutSources,
          "AddonInsertArticleGoogleDocWithoutSources",
          articleData
        ).then( (data) => {
          results.push(data);
        })
        
      }) 
    });
    returnValue.data = results;
  }  
  return returnValue;
}

async function hasuraHandlePublish(formObject) {
  // set the email for auditing changes
  var currentUserEmail = Session.getActiveUser().getEmail();
  formObject["created_by_email"] = currentUserEmail;

  var slug = formObject['article-slug'];
  var headline = formObject['article-headline'];

  if (headline === "" || headline === null || headline === undefined) {
    return {
      message: "Headline is required",
      status: "error",
      data: formObject
    }
  }

  if (slug === "" || slug === null || slug === undefined) {
    slug = slugify(headline);
    formObject['article-slug'] = slug;
  } else {
    // always ensure the slug is valid, no spaces etc
    slug = slugify(slug);
    formObject['article-slug'] = slug;
  }

  // NOTE: this flag tells the insert mutation to mark this new translation record as PUBLISHED
  //   - this is set to false when the 'preview article' button is clicked instead.
  formObject['published'] = true;

  var data;
  var documentType;
  var publishUrl;

  var documentID = DocumentApp.getActiveDocument().getId();
  var isStaticPage = isPage(documentID);

  if (isStaticPage) {
    documentType = "page";
    // insert or update page
    var insertPage = await insertPageGoogleDocs(formObject);
    if (insertPage.status === "error") {
      insertPage["documentID"] = documentID;
      return insertPage;
    }
    data = insertPage.data;
    Logger.log("pageResult: " + JSON.stringify(data))

    publishUrl = insertPage.publishUrl;

    var pageID = data.id;

    var getOrgLocalesResult = await hasuraGetOrganizationLocales();
    // Logger.log("Get Org Locales:" + JSON.stringify(getOrgLocalesResult));
    data.organization_locales = getOrgLocalesResult.data.organization_locales;

    // // store slug + page ID in slug versions table
    var result = await storePageIdAndSlug(pageID, slug);
    Logger.log("stored page id + slug: " + JSON.stringify(result));

  } else {
    documentType = "article";
 
    var insertArticle = await insertArticleGoogleDocs(formObject);
    if(insertArticle.status === "error") {
      insertArticle["documentID"] = documentID;
      return insertArticle;
    }
    Logger.log(JSON.stringify(insertArticle));

    publishUrl = insertArticle.publishUrl;

    data = insertArticle.data;
    
    var getOrgLocalesResult = await hasuraGetOrganizationLocales();
    // Logger.log("Get Org Locales:" + JSON.stringify(getOrgLocalesResult));
    data.organization_locales = getOrgLocalesResult.data.organization_locales;

  }

  // trigger republish of the site to reflect new article
  rebuildSite();

  // open preview url in new window
  var message = "Published the " + documentType + ". <a href='" + publishUrl + "' target='_blank'>Click to view</a>."

  return {
    message: message,
    data: data,
    documentType: documentType,
    documentID: documentID,
    status: "success"
  }
}

async function hasuraHandlePreview(formObject) {
  // set the email for auditing changes
  var currentUserEmail = Session.getActiveUser().getEmail();
  formObject["created_by_email"] = currentUserEmail;

  var slug = formObject['article-slug'];
  var headline = formObject['article-headline'];

  if (headline === "" || headline === null || headline === undefined) {
    return {
      message: "Headline is required",
      status: "error",
      data: formObject
    }
  }

  if (slug === "" || slug === null || slug === undefined) {
    slug = slugify(headline)
    Logger.log("no slug found, generated from headline: " + headline + " -> " + slug)
    formObject['article-slug'] = slug;
  } else {
    slug = slugify(slug)
    formObject['article-slug'] = slug;
  }

  // NOTE: this flag tells the insert mutation to mark this new translation record as UNPUBLISHED
  //   - this is set to true when the 'publish article' button is clicked instead.
  formObject['published'] = false;

  var data;
  var documentType;
  var previewUrl;

  var documentID = DocumentApp.getActiveDocument().getId();
  var isStaticPage = isPage(documentID);

  if (isStaticPage) {
    documentType = "page";
    // insert or update page
    var insertPage = await insertPageGoogleDocs(formObject);
    if (insertPage.status === "error") {
      insertPage["documentID"] = documentID;
      return insertPage;
    }

    var data = insertPage.data;
    Logger.log("pageResult: " + JSON.stringify(data))

    previewUrl = insertPage.previewUrl;

    var pageID = data.id;

    var getOrgLocalesResult = await hasuraGetOrganizationLocales();
    // Logger.log("Get Org Locales:" + JSON.stringify(getOrgLocalesResult));
    data.organization_locales = getOrgLocalesResult.data.organization_locales;

    // store slug + page ID in slug versions table
    var result = await storePageIdAndSlug(pageID, slug);
    Logger.log("stored page id + slug: " + JSON.stringify(result));

  } else {
    documentType = "article";
    
    var insertArticle = await insertArticleGoogleDocs(formObject);
    Logger.log("insertArticle response: " + JSON.stringify(insertArticle));
    if (insertArticle.status === "error") {
      insertArticle["documentID"] = documentID;
      return insertArticle;
    }

    previewUrl = insertArticle.previewUrl;

    var data = insertArticle.data;
   
    var getOrgLocalesResult = await hasuraGetOrganizationLocales();
    // Logger.log("Get Org Locales:" + JSON.stringify(getOrgLocalesResult));
    data.organization_locales = getOrgLocalesResult.data.organization_locales;

  }

  var message = "<a href='" + previewUrl + "' target='_blank'>Preview " + documentType + " in new window</a>";

  return {
    message: message,
    data: data,
    documentType: documentType,
    documentID: documentID,
    status: "success"
  }
}


function hasuraGetOrganizationLocales() {
  return fetchGraphQL(
    getOrganizationLocalesQuery,
    "AddonGetOrganizationLocales"
  );
}

function fetchArticleForGoogleDoc(doc_id) {
  return fetchGraphQL(
    getArticleByGoogleDocQuery,
    "AddonGetArticleByGoogleDoc",
    {"doc_id": doc_id}
  );
}

function fetchPageForGoogleDoc(doc_id) {
  return fetchGraphQL(
    getPageForGoogleDocQuery,
    "AddonGetPageForGoogleDoc",
    {"doc_id": doc_id}
  );
}

function fetchFeaturedArticles() {
  return fetchGraphQL(
    getHomepageFeaturedArticles,
    "AddonGetHomepageFeaturedArticles"
  );
}

async function isArticleFeatured(articleId) {
  const { errors, data } = await fetchFeaturedArticles();

  if (errors) {
    console.error("errors:" + JSON.stringify(errors));
    throw errors;
  }

  var scriptConfig = getScriptConfig();
  var editorUrl = scriptConfig['EDITOR_URL'];

  // Logger.log("data: " + JSON.stringify(data))
  var isFeatured = false;
  if (data && data.homepage_layout_datas) {
    
    data.homepage_layout_datas.forEach(hpData => {
      var values = Object.values(hpData);
      Logger.log(values);
      if (values.includes(articleId)){
        isFeatured = true;
        Logger.log(articleId + " article is featured")
      }
    });
  }
  return {
    featured: isFeatured,
    editorUrl: editorUrl
  };
}

/*
.* called from ManualPage.html, this function searches for a matching article by headline
.*/
function hasuraSearchArticles(formObject) {
  var localeCode = formObject["locale-code"];
  if (localeCode === undefined || localeCode === null) {
    localeCode = "en-US" // TODO should we default this way?
  }
  var term = "%" + formObject["article-search"] + "%";
  return fetchGraphQL(
    searchArticlesByHeadlineQuery,
    "AddonSearchArticlesByHeadline",
    {"term": term, "locale_code": localeCode}
  );
}

/*
 * looks up a page by google doc ID and locale
 */
async function getPageForGoogleDoc(doc_id) {
  const { errors, data } = await fetchPageForGoogleDoc(doc_id);

  if (errors) {
    console.error("errors:" + JSON.stringify(errors));
    throw errors;
  }

  return data;
}

function fetchTranslationDataForPage(docId, pageId, localeCode) {
  return fetchGraphQL(
    getPageTranslationForIdAndLocale,
    "AddonGetPageTranslationByLocaleAndID",
    {"doc_id": docId, "page_id": pageId, "locale_code": localeCode}
  );
}

function fetchTranslationDataForArticle(docId, articleId, localeCode) {
  return fetchGraphQL(
    getArticleTranslationForIdAndLocale,
    "AddonGetArticleTranslationByLocaleAndID",
    {"doc_id": docId, "article_id": articleId, "locale_code": localeCode}
  );
}

async function getTranslationDataForPage(docId, pageId, localeCode) {
  const { errors, data } = await fetchTranslationDataForPage(docId, pageId, localeCode);

  if (errors) {
    console.error("errors:" + JSON.stringify(errors));
    throw errors;
  }

  return data;
}

async function getTranslationDataForArticle(docId, articleId, localeCode) {
  const {errors, data, orgSlug } = await fetchTranslationDataForArticle(docId, articleId, localeCode);

  data.orgSlug = orgSlug;
  Logger.log("getTranslationDataForArticle orgSlug: " + orgSlug + " data keys: " + JSON.stringify(Object.keys(data)));

  if (errors) {
    console.error("errors:" + JSON.stringify(errors));
    throw errors;
  }

  return data;
}

/*
 * looks up an article by google doc ID and locale
 */
async function getArticleForGoogleDoc(doc_id) {
  const { errors, data } = await fetchArticleForGoogleDoc(doc_id);

  if (errors) {
    console.error("errors:" + JSON.stringify(errors));
    throw errors;
  }

  return data;
}

  // this logs whether the doc is in an "articles" or "pages" folder
  // otherwise, it's in the wrong spot and we should throw an error
function isValid(documentID) {
  var driveFile = DriveApp.getFileById(documentID)
  var fileParents = driveFile.getParents();

  var docIsValid = false;
  while ( fileParents.hasNext() ) {
    var folder = fileParents.next();
    if (folder.getName() === "pages") {
      docIsValid = true;
    } else if (folder.getName() === "articles") {
      docIsValid = true;
    }
  }
  return docIsValid;
}

function isPage(documentID) {
  // determine if this is a static page or an article - it will usually be an article
  var driveFile = DriveApp.getFileById(documentID)
  var fileParents = driveFile.getParents();
  var isStaticPage = false;

  while ( fileParents.hasNext() ) {
    var folder = fileParents.next();
    if (folder.getName() === "pages") {
      isStaticPage = true;
    }
  }
  return isStaticPage;
}

async function hasuraGetTranslations(pageOrArticleId, localeCode) {
  var returnValue = {
    localeCode: localeCode,
    articleId: pageOrArticleId,
    status: "",
    message: "",
    data: {}
  };

  var document = DocumentApp.getActiveDocument();
  var documentID = document.getId();
  var documentTitle = document.getName();

  returnValue.documentTitle = documentTitle;
  returnValue.documentId = documentID;

  var isStaticPage = isPage(documentID);

  var data;
  try {
    if (isStaticPage) {
      returnValue.docType = "page";
      returnValue.status = "success";

      data = await getTranslationDataForPage(documentID, pageOrArticleId, localeCode);
      
      if (data && data.page_translations && data.page_translations[0]) {
        returnValue.message = "Retrieved page translation with ID: " + data.page_translations[0].id;
      } else if (!data) {
        returnValue.status = "error";
        returnValue.message = "An error occurred retrieving page translations.";
      }
      returnValue.data = data;

    } else {
      returnValue.docType = "article";
      returnValue.status = "success";

      data = await getTranslationDataForArticle(documentID, pageOrArticleId, localeCode);
      if (data && data.article_translations && data.article_translations[0]) {
        returnValue.message = "Retrieved article translation with ID: " + data.article_translations[0].id;
      } else if (!data) {
        returnValue.status = "error";
        returnValue.message = "An error occurred retrieving article translations.";
      }
      returnValue.data = data;
    }

  } catch (err) {
    Logger.log(JSON.stringify(err));
    returnValue.status = "error";
    returnValue.message = "An error occurred getting the article or page";
    returnValue.data = err;
  }

  return returnValue;
}
/*
. * Returns metadata about the article, including its id, whether it was published
. * headline and byline
. */
async function hasuraGetArticle() {
  var returnValue = {
    status: "",
    message: "",
    data: {}
  };

  var document = DocumentApp.getActiveDocument();
  var documentID = document.getId();
  var documentTitle = document.getName();
  Logger.log("documentID: " + documentID);
  returnValue.documentId = documentID;

  let documentType = 'article';
  let isStaticPage = isPage(documentID);
  if (isStaticPage) {
    documentType = 'page';
  }
 
  var valid = isValid(documentID);
  if (!valid) {
    returnValue.status = "error";
    returnValue.message = "Documents must be in the right folder to be published: orgName/articles (and subfolders) for articles and orgName/pages for static pages (like About or Contact); please move this document and try again."
    return returnValue;
  }

  let data = await lookupDataForDocument(documentID, documentType);
  if (!data.documentType) {
    data.documentType = documentType;
  }
  
  returnValue.documentType = data.documentType;
  
  if (data && data.documentType === 'page' && data.page && data.page.slug) {
    storeArticleSlug(data.page.slug);
    returnValue.data = data;
    returnValue.status = "success";
    returnValue.message = "Retrieved page with ID: " + data.page.id;

  } else if (data && data.documentType === 'page' && !data.page) {
    Logger.log("page not found: " + JSON.stringify(data));
    returnValue.data = data;
    returnValue.status = "notFound";
    returnValue.message = "Page not found";

  } else if (data && data.documentType === 'article' && data.article && data.article.slug) {
    storeArticleSlug(data.article.slug);
    data.headline = documentTitle;
    data.searchTitle = documentTitle;
    returnValue.data = data;
    returnValue.status = "success";
    returnValue.message = "Retrieved article with ID: " + data.article.id;

  } else if (data && data.documentType === 'article' && !data.article) {
    Logger.log("article not found: " + JSON.stringify(data));
    data.headline = documentTitle;
    data.searchTitle = documentTitle;
    returnValue.data = data;
    returnValue.status = "notFound";
    returnValue.message = "Article not found";

  } else {
    Logger.log("Something went wrong looking up the document: " + JSON.stringify(data));
    returnValue.data = data;
    returnValue.status = "error";
    returnValue.message = "Something went wrong looking up the document" + JSON.stringify(data);
  }

  Logger.log("returnValue: " + JSON.stringify(returnValue));

    // Logger.log("error: " + JSON.stringify(err));
    // returnValue.status = "error";
    // returnValue.message = "An error occurred getting the article or page";
    // returnValue.data = err;

  return returnValue;
}

/**
. * Gets the current document's contents
. */
async function getCurrentDocContents() {
  

  return formattedElements;
}

async function apiSaveArticle(articleData, slug, contents, listInfo, imageList, inlineObjects) {
  var scriptConfig = getScriptConfig();
  var API_TOKEN = scriptConfig['DOCUMENT_API_TOKEN'];
  var API_URL = scriptConfig['DOCUMENT_API_URL'];
  var ORG_SLUG = scriptConfig['ACCESS_TOKEN'];

  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = activeDoc.getId();

  let apiAction = 'preview';
  if (articleData['published']) {
    apiAction = 'publish';
  }
  const requestURL = `${API_URL}/api/sidebar/documents/${documentID}/${apiAction}?token=${API_TOKEN}&documentType=article`
  Logger.log("REQUEST URL: " + requestURL);

  var options = {
    method: 'POST',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      "TNC-Organization": ORG_SLUG
    },
    payload: JSON.stringify({
      articleData: articleData,
      googleAuthToken: ScriptApp.getOAuthToken(),
      contents: contents,
      slug: slug,
      listInfo: listInfo,
      imageList: imageList,
      inlineObjects: inlineObjects
    }),
  };

  const result = await UrlFetchApp.fetch(
    requestURL,
    options
  );
  
  var responseText = result.getContentText();
  var responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch(e) {
    console.error(e)
    responseData = {
      status: 'error',
      data: responseText
    }
  }

  return responseData;
}
async function previewPage(pageData, slug, contents, listInfo, imageList, inlineObjects) {
  var scriptConfig = getScriptConfig();
  var API_TOKEN = scriptConfig['DOCUMENT_API_TOKEN'];
  var API_URL = scriptConfig['DOCUMENT_API_URL'];
  var ORG_SLUG = scriptConfig['ACCESS_TOKEN'];

  var activeDoc = DocumentApp.getActiveDocument();
  var documentID = activeDoc.getId();

  const requestURL = `${API_URL}/api/sidebar/documents/${documentID}/preview?token=${API_TOKEN}&documentType=page`
  Logger.log("REQUEST URL: " + requestURL);

  var options = {
    method: 'POST',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      "TNC-Organization": ORG_SLUG
    },
    payload: JSON.stringify({
      pageData: pageData,
      googleAuthToken: ScriptApp.getOAuthToken(),
      contents: contents,
      slug: slug,
      listInfo: listInfo,
      imageList: imageList,
      inlineObjects: inlineObjects
    }),
  };

  const result = await UrlFetchApp.fetch(
    requestURL,
    options
  );
  
  var responseText = result.getContentText();
  var responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch(e) {
    console.error(e)
    responseData = {
      status: 'error',
      data: responseText
    }
  }

  return responseData;
}

/*
.* Retrieves "elements" from the google doc - which are headings, images, paragraphs, lists
.* Preserves order, indicates that order with `index` attribute
.*/
async function getElements() {
 
  return orderedElements;
}


/*
.* Gets elements and formats them into JSON structure for us to work with on the front-end
.*/
function formatElements(elements) {
  var formattedElements = [];
  elements.sort(function (a, b) {
    if (a.index > b.index) {
      return 1;
    } else {
      return -1;
    }
  }).forEach(element => {
    Logger.log("element.type: " + element.type + " - " + JSON.stringify(element))
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

async function getMainImage(elements) {
  var mainImageNodes = elements.filter(element => element.type === 'mainImage');

  if (!mainImageNodes[0]) {
    // console.log("no mainImage type found in elements " + JSON.stringify(elements))
    return {}
  }
  // Logger.log("mainImageNodes[0]: " + JSON.stringify(mainImageNodes[0]));
  return mainImageNodes[0];
}
/**
 * Rebuilds the site by POSTing to deploy hook
 */
function rebuildSite() {
  var scriptConfig = getScriptConfig();
  var WEBHOOK = scriptConfig['VERCEL_WEBHOOK'];

  var options = {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json'
  };

  var response = UrlFetchApp.fetch(
    WEBHOOK,
    options
  );
  var responseText = response.getContentText();
  var responseData = JSON.parse(responseText);
  return responseData;
}
