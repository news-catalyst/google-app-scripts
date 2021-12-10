# Google Docs Publishing Tools Add-On Functionality

## On Sidebar Load

### What Should Happen

Figure out if the current google doc is known for the organization and return all information required to set up the sidebar for editing with one API call. 

If this is a new document, the sidebar should have enough data to supply choices for things like category, tags, and authors. 

If this is an existing document, some things need to be saved in the html as hidden fields, a la the web circa the early 2000s, as the Google Apps Script environment is very rudimentary. (The docs still note that it supports jQuery, if that sheds any light.)

Ideally, we could make a single API call with the Google Document ID (easy lookup available from `Code.js`, not from the html) that returns:
* top level article or page data
* latest translation data, including SEO fields
* content publishing status, including dates
* content translation status, including linked Google Docs (translations)
* article sources
* site/organization-level data for assignable or usable:
  * authors
  * categories (sections)
  * locales
  * tags
  
### What Currently Happens

Several API calls happen via http requests, passing the entire graphql query in the POST data, to determine if this google doc is known or new and get all the info necessary to set up the sidebar for editing.

On page load, calls backend function [`hasuraGetArticle()`](https://github.com/news-catalyst/google-app-scripts/blob/master/Notes.md#hasuragetarticle) (see below, defined in Code.js). 

If this call is successful, calls [`handleGetTranslationsForArticle()`](https://github.com/news-catalyst/google-app-scripts/blob/master/Notes.md#hasuragettranslations), which stores some of the `hasuraGetArticle` data in the sidebar and kicks off another backend function call `hasuraGetTranslations()` for either the known articleID or pageID, depending on document type.

If the translation lookup is successful, calls `onSuccessGetArticle()` which sets up UI stuff in the sidebar.

Makes an additional backend call to `isArticleFeatured()` which checks if this document is for an article currently featured on the homepage.

UI stuff that happens after translation data is available:

* if static page document, hides any article-only features in the sidebar 
* if new document, defaults locale to `en-US`
* displays translation tools (open existing translation, create translation)
* populates: locale, category, tag, and author select menus / typeahead suggest fields
* displays publishing info (is published?, first/last pub dates)
* stores some hidden data to facilitate later functionality:
  * organization slug
  * article (or page) ID
  * document type
  * source tracking counter

1. [hasuraGetArticle](https://github.com/news-catalyst/google-app-scripts/blob/master/Code.js#L1502-L1569)

Determines if the Google Doc is a static page or an article: this is based on the folder in Google Drive (`articles` or `pages`).

#### If Page

* [getPageForGoogleDoc](https://github.com/news-catalyst/google-app-scripts/blob/b142198b74608b7e759eb2d79dae38c748485f74/Code.js#L1346-L1355) [[graphql query](https://github.com/news-catalyst/google-app-scripts/blob/d4f3a137d0ac03205d3a18ccef0da30f87919c6a/GraphQL.js#L726-L762)]: gets basic page information along with locales and authors from Hasura; validates this page is known in the database; 
* stores slug in the document properties
* returns success message along with data, this triggers an additional lookup of the page translation data

#### If Article

* [getArticleForGoogleDoc](https://github.com/news-catalyst/google-app-scripts/blob/b142198b74608b7e759eb2d79dae38c748485f74/Code.js#L1401-L1410) [graphql query](https://github.com/news-catalyst/google-app-scripts/blob/d4f3a137d0ac03205d3a18ccef0da30f87919c6a/GraphQL.js#L478-L558): gets basic article data including sources/category/tags/authors, along with site authors, categories, locales, tags used for populating the sidebar form
* stores slug in the document properties
* returns success message along with data, this triggers an additional lookup of the article translation data

2. [hasuraGetTranslations](https://github.com/news-catalyst/google-app-scripts/blob/master/Code.js#L1445-L1501)

Finds most recent translation for the article or page in the current locale.

#### If Page

* [getTranslationDataForPage](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L1373-L1382) [graphql query](https://github.com/news-catalyst/google-app-scripts/blob/master/GraphQL.js#L560-L624)

#### If Article

* [getTranslationDataForArticle](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L1384-L1396) [graphql query](https://github.com/news-catalyst/google-app-scripts/blob/master/GraphQL.js#L626-L724)


3. [isArticleFeatured](https://github.com/news-catalyst/google-app-scripts/blob/master/Code.js#L1297-L1325)

Whether this article is currently featured on the homepage. 

Why? 

* because we don't allow unpublishing a featured article (it causes problems in Hasura with data integrity)
* and so we can include a link to the homepage editor (set in Admin Tools config)

## Preview

Allows viewing the content in the front-end preview template without publishing. There are two preview buttons, one at the top and one at the bottom of the sidebar - both make the same exact backend calls.

Preview saves the document contents and sidebar-defined metadata to Hasura. Some of the info is stored on the top-level article or page record overwriting previous values. The rest, specifically the document contents, is stored as the latest translation record associated with the article or page. 

A link is displayed to the preview version of the article or page on success.

### What Should Happen

tk

### What Currently Happens
tk

## Publish

Saves the document contents and metadata and publishes it to the organization's site (makes it public). This works the same as preview (see above) except the publish flag is set to true and first/last published dates are set.

A link to the published version of the article or page is displayed on success.

### What Should Happen

tk

### What Currently Happens
tk

## Unpublish

This marks the published content as no longer published by setting the published flag to false.

### What Should Happen

tk

### What Currently Happens
tk

## Translation

Available on sites with more than one locale.

### What Should Happen

tk

### What Currently Happens
tk