# Google App Scripts for tinynews

This repo is a collection of scripts for a Google Docs publishing add-on for tinynewsco sites.

The add-on is in release v3 (`02Sept2020`) published as `version 31` in the Google SDK Marketplace - private, for News Catalyst Google users.

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

### Preview Article

Saves the article as a draft in Webiny and returns a (currently localhost only) url to preview it.

### Publish Article

Saves the contents of the current document in Webiny as a draft then publishes it. It does the following:

* checks for a stored localeID
  * if none found, gets the list of locales from webiny, selects the default locale, and stores its ID as the localeID
* checks for a stored articleID
  * if none found, calls the CreateBasicArticle mutation, then stores the new articleID
  * if found, calls the CreateArticleFrom mutation

### Get Locales

Requests the list of locales from Webiny. Right now this is all that happens. There are some issues to be worked out here, starting with how to authenticate against the webiny graphql API. It's... complicated. Details can be found in [issue #7](https://github.com/news-catalyst/google-app-scripts/issues/7)