# Google Docs Add-On Functionality

## Sidebar Load

### What Should Happen

Figure out if the current google doc is known for the organization and return all information required to set up the sidebar for editing.

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

On page load, calls backend function [`hasuraGetArticle()`](https://github.com/news-catalyst/google-app-scripts/blob/master/Notes.md#hasuragetarticle) (see below, defined in Code.js). 

If this call is successful, calls [`handleGetTranslationsForArticle()`](https://github.com/news-catalyst/google-app-scripts/blob/master/Notes.md#hasuragettranslations), which stores some of the `hasuraGetArticle` data in the sidebar and kicks off another backend function call `hasuraGetTranslations()` for either the known articleID or pageID, depending on document type.

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

* tk

#### If Article

* tk


3. TK