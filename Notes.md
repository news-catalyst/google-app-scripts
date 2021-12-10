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

The google doc is parsed and the formatted data, along with any related metadata configured in the sidebar, is saved. A single API call should take all of the information, create or update it in the database, and return a link to the previewable article or page.

I could see an argument potentially made to send the unformatted raw Google Docs markup to the API for parsing and re-formatting, but I think it's okay to leave it in the sidebar "backend" (Code.js) code. Why? Because this is very specific to Google Docs, so I feel the logic belongs in Google Docs. I'm open to being convinced otherwise though given a good reason.

The current implementation of `preview` makes a lot of API calls. I think this should be consolidated into one call that does all of the data wrangling, error checking, and returns the resulting data and preview URL. I don't think the sidebar should be determining this URL, which is what's happening now.

### What Currently Happens

The document contents are parsed to take them from the Google Docs format to one usable by our front-end. The following are the special cases that the code particularly handles:

* headings: sizes 1-6 are supported
* formatted text: bold, italic and underline currently supported
* lists: both ordered (numbered) and unordered (bulleted)
* indented paragraphs: become blockquotes
* horizontal lines: become `hr`s
* links: google docs treats any linked text as separate from the surrounding text, so care must be taken to preserve the location and flow of links in the bigger document, or at least the paragraph each is found in.
* embeds: these are really links in the document that appear on a line on their own; a regex determines if the specific link is supported as an embed and includes instagram, twitter, facebook, tiktok, spotify, apple, and vimeo.
* images: the first image is treated as the main image for an article, subsequent images are saved in context; image alt text (right click in google docs to specify) is treated as photo captions on the front-end

All content in the google doc is given a unique index which determines the order it appears in. So a paragraph of text with several separate words linked would use each element's index to preserve the order of the words and surrounding sentences.

The front-end [handleClick()](https://github.com/news-catalyst/google-app-scripts/blob/master/Page.html#L1142-L1331) function is triggered on any Preview/Publish/Unpublish button call. It gathers up and validates the sidebar data then determines which back-end function to call.

* [hasuraHandlePreview()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L1107-L1264) has a switch for either article or page handling. It generates a slug based on the headline if one is not provided, and it explicitly sets the `published` boolean flag to false up front (this is stored in the database and determines if content is publicly viewable).

### If Page

* [insertPageGoogleDocs()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L347-L407): 
  * checks if a page already exists with the slug and returns an error if so (must be unique)
  * parses the Google Doc contents and formats the data for our purposes using [getCurrentDocContents()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L1574-L1932)
  * without an existing page ID, uses [a mutation that does not require an ID](https://github.com/news-catalyst/google-app-scripts/blob/master/GraphQL.js#L338-L366) to create a new page
  * with an existing page ID, uses [a mutation that does specify the ID](https://github.com/news-catalyst/google-app-scripts/blob/master/GraphQL.js#L367-L395) to update the existing page
  * if any authors are specified for the page, these are stored in a subsequent API call [hasuraCreateAuthorPage()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L571-L580)
  * finally, another API call is made that stores the page slug and id in the page slug versions table, which is what the front-end uses to look up the content to display from the URL; the "versions" aspect of it is a hint that it supports current and previous slug values, so if the slug is changed old links should still work for the most part

### If Article

* [insertArticleGoogleDocs()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L451-L569):
  * checks if article exists in the current category with the given slug, returns an error if so (combination must be unique)
  * parses the Google Doc contents and formats the data for our purposes using [getCurrentDocContents()](https://github.com/news-catalyst/google-app-scripts/blob/7a6d567f64475f6b164981c91928978b09320227/Code.js#L1574-L1932)
  * finds the main image
  * processes and formats data for any specified article sources
  * does an API call to store the article contents and metadata, with or without an ID, just like the page handling described above
* does an API call to store the article ID and slug in the article versions table, similar to the page versions table mentioned above this handles mapping URLs to current and past unique slug identifiers
* does a series of further back-end API calls to delete any previous associations between the article and authors and tags - these are recreated on every save, it's just easier to blank them out first than to determine if any were removed in the UI
* does an API call to get all supported locales in the organization, though I'm not sure I remember why this is happening here instead of being supplied by an earlier call; the result is added onto the `data` this `insertArticleGoogleDocs()` function returns, which is then, I know, used by the front-end `Page.html` for the translation tools stuff
* loops over any specified tags and stores the association in the database; any brand new tags are created first
* loops over any specified articles and stores the association; all authors must be exist already, you can't create new authors from the sidebar
* finally, assembles the preview URL and returns it along with earlier data assembled above for the front-end to display

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