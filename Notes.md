# Google Docs Add-On Functionality

## Sidebar Load

On page load, calls backend function `hasuraGetArticle()` (see below, defined in Code.js). 

If this call is successful, calls `handleGetTranslationsForArticle()`, which stores some of the `hasuraGetArticle` data in the sidebar and kicks off another backend function call `hasuraGetTranslations()` for either the known articleID or pageID, depending on document type.

### [hasuraGetArticle](https://github.com/news-catalyst/google-app-scripts/blob/master/Code.js#L1502-L1569)

Determines if the Google Doc is a static page or an article: this is based on the folder in Google Drive (`articles` or `pages`).

#### IF Page

* [getPageForGoogleDoc](https://github.com/news-catalyst/google-app-scripts/blob/b142198b74608b7e759eb2d79dae38c748485f74/Code.js#L1346-L1355) [[graphql query](https://github.com/news-catalyst/google-app-scripts/blob/d4f3a137d0ac03205d3a18ccef0da30f87919c6a/GraphQL.js#L726-L762)]: gets basic page information along with locales and authors from Hasura; validates this page is known in the database; 
* stores slug in the document properties
* returns success message along with data, this triggers an additional lookup of the page translation data

#### IF Article

* [getArticleForGoogleDoc](https://github.com/news-catalyst/google-app-scripts/blob/b142198b74608b7e759eb2d79dae38c748485f74/Code.js#L1401-L1410) [graphql query](https://github.com/news-catalyst/google-app-scripts/blob/d4f3a137d0ac03205d3a18ccef0da30f87919c6a/GraphQL.js#L478-L558): gets basic article data including sources/category/tags/authors, along with site authors, categories, locales, tags used for populating the sidebar form
* stores slug in the document properties
* returns success message along with data, this triggers an additional lookup of the article translation data

### [hasuraGetTranslations](https://github.com/news-catalyst/google-app-scripts/blob/master/Code.js#L1445-L1501)

Finds most recent translation for the article or page in the current locale.

#### IF Page

* tk

#### IF Article

* tk