# Google Docs Sidebar for the Tiny News Platform

This is the codebase for the Tiny News Google Docs sidebars used to publish to the tiny news platform. There are two sidebars: Admin Tools, used for configuration, and Publishing Tools, used to preview, publish and set metadata on content. This set of scripts used to include a lot of custom logic for formatting and processing content; this has all largely been moved to the front-end app's document API.
 
> This README is current as of 9 May 2022.

## Howto

You can create, edit, test-run and publish this collection of Google apps scripts in [the Google Script Editor](https://script.google.com/a/newscatalyst.org/d/1ILURq69o3cYUy6k1n1X6HwxdMfl9xWNhILYuZxgLfeblb3IR15WCMZSj/edit).

To publish the sidebar:

* create a new version in the script editor with a description
* open the [Google Workspace Marketplace page](https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps_sdk?project=webiny-sidebar-publishing&authuser=0) in the Cloud Console
* enter the new version number you created in the field named "Docs Add-on script version"
* then scroll to the bottom of the page and click "Save"
* it may take a few minutes for the new version of the sidebar to appear

## Scripts

* `Code.js` contains functions used to get content from the current Google Doc and interact with [the next.js document API](https://github.com/news-catalyst/next-tinynewsdemo/tree/main/pages/api/sidebar/documents)
* `Page.html` displays the Publishing Tools sidebar
* `ManualPage.html` displays the Admin Tools sidebar
* `appsscript.json` tells the add-on what oauth scopes it can use (several are required for interacting with the document and with third party services)

## Features

### Metadata

Some metadata is necessary for articles or pages to be saved. It is marked as 'required' in the form that appears in the 'Publishing Tools' sidebar. The rest is useful and up to the editor to supply.

The Authors suggest field uses existing authors as a data source; these can be managed in the site's tinycms. Any authors assigned to a story from this field will become clickable links in the byline that lead to author index pages. Alternatively, an author that's not in the tinycms can be specified using the "custom byline" field.

The Category/Section field is required and gets its list of values from the site's tinycms.

Tags acts as a suggest field, leveraging existing tag values, and also allows new tags to be added directly from the sidebar.

The search, facebook and twitter fields are used to fill in the `meta` tags on the published article or page that determine content in shared posts or search results.

Articles include optional 'source tracking' that is used for internal audits of diversity in reporting.

### Lookup

This happens when you open the Publishing Tools sidebar: the google doc id is used to find an associated article or page in the database. If one is found, it is used to fill in the metadata form and for any preview or publish action. Otherwise, a new article or page must be created. Whether the google doc is for an article or page is determined by the folder it lives in (articles or pages) in Google Drive.

### Preview

Saves the article or page content as a new version, unpublished, and returns a preview url to view the latest content on the site.

### Publish

This button appears if an article or page has not yet been published. It saves the contents of the current document as a new version of an article or page, published, and returns the live URL to view it on the site.

### Re-Publish

This works the same as "publish", but appears if the content has been published at least once.

### Unpublish 

This flips the `published` flag to false so the content is no longer accessible on the live site. It does not delete the current or past versions, it merely switches whether it is viewable.
