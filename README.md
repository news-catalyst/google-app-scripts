# Google App Scripts for tinynews

This repo is a collection of scripts for Google Docs add-ons used in publishing to tinynewsco sites.

## Howto

You can create, edit, test-run and publish apps scripts from the Google Script Editor at https://script.google.com/

* [URLFetchApp info](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app)
* [HTML Service - used to display the sidebar](https://developers.google.com/apps-script/guides/html)
* [Running server side JS functinos from the sidebar](https://developers.google.com/apps-script/guides/html/communication)

More info tk.

## Scripts

* `Code.js` contains functions used to get content from the current Google Doc and to post it to Webiny's content API
* `Page.html` is what the add-on's sidebar displays
* `appsscript.json` tells the add-on what oauth scopes it can use (several are required for interacting with the document and with third party services)

## Features

### Save Article

This button on the sidebar will store the contents of the current document in Webiny. It does the following:

* checks for a stored localeID
  * if none found, gets the list of locales from webiny, selects the default locale, and stores its ID as the localeID
* checks for a stored articleID
  * if none found, calls the CreateBasicArticle mutation, then stores the new articleID
  * if found, calls the UpdateBasicArticle mutation

### Get Locales

Requests the list of locales from Webiny. Right now this is all that happens. There are some issues to be worked out here, starting with how to authenticate against the webiny graphql API. It's... complicated. Details can be found in [issue #7](https://github.com/news-catalyst/google-app-scripts/issues/7)