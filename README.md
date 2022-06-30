# Google Docs Sidebar for the Tiny News Platform

This is the codebase for the Tiny News Google Docs sidebars used to publish to the tiny news platform. There are two sidebars: Admin Tools, used for configuration, and Publishing Tools, used to preview, publish and set metadata on content. This set of scripts used to include a lot of custom logic for formatting and processing content; this has all largely been moved to the front-end app's document API.
 
> This README is current as of 30 June 2022.

## Development and deployment process

The actual Google Apps Script project is managed in the [Google Apps Script editor](https://script.google.com). This repo is mostly so we have the project in some form of version control. To work on this codebase, use the following steps. Please make sure you're using the new version of the Apps Script editor to follow these steps.

1. Write code locally by cloning this repo to your local machine and editing the code.
2. When you're ready to test, copy and paste your local code into the [Google Apps Script editor](https://script.google.com/home/projects/1ILURq69o3cYUy6k1n1X6HwxdMfl9xWNhILYuZxgLfeblb3IR15WCMZSj/edit)
3. Click "Deploy" in the top right and select "Test Deployments."
4. Either use one of the saved tests or create a new test against a new document. When you've selected the test document you want to run, click "Execute." This will open a new tab with your test document. Run the sidebar in this tab to test your new functionality.
5. When your code is correct, commit the final version to this repository in a feature branch, and submit a pull request for review.
6. The code reviewer should test the code via the same test document the original developer used in step 4. Once the code is reviewed, the reviewer should merge the pull request.
7. Back in the Google Apps Script editor, create a new deployment by clicking "Deploy", then "New deployment." Select your deployment type as "Add-on", then describe the deployment with the same name as the pull request you just merged. Click deploy. Note the version number of the new deployment.
8. Finally, go to [this page](https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps_sdk?authuser=0&project=webiny-sidebar-publishing) for the Google Workspace Marketplace SDK, and scroll down to "Docs Add-on script version." Increment the version number to the new version. Click save at the bottom of the page.

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
