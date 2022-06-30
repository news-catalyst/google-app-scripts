# TinyCMS Publishing Tools

This repo contains the Google Apps Script project that controls the TinyCMS Publishing Tools, allowing TNC members to publish stories from Google Docs.

## Development and deployment process

The actual Google Apps Script project is managed in the [Google Apps Script editor](https://script.google.com). This repo is mostly so we have the project in some form of version control. To work on this codebase, use the following steps.

1. Write code locally by cloning this repo to your local machine and editing the code.
2. When you're ready to test, copy and paste your local code into the Google Apps Script editor
3. Click "Deploy" in the top right and select "Test Deployments."
4. Either use one of the saved tests or create a new test against a new document. When you've selected the test document you want to run, click "Execute." This will open a new tab with your test document. Run the sidebar in this tab to test your new functionality.
5. When your code is correct, commit the final version to this repository in a feature branch, and submit a pull request for review.
6. The code reviewer should test the code via the same test document the original developer used in step 4. Once the code is reviewed, the reviewer should merge the pull request.
7. Back in the Google Apps Script editor, create a new deployment by clicking "Deploy", then "New deployment." Select your deployment type as "Add-on", then describe the deployment with the same name as the pull request you just merged. Click deploy. Note the version number of the new deployment.
8. Finally, go to [this page](https://console.cloud.google.com/apis/api/appsmarket-component.googleapis.com/googleapps_sdk?authuser=0&project=webiny-sidebar-publishing) for the Google Workspace Marketplace SDK, and scroll down to "Docs Add-on script version." Increment the version number to the new version. Click save at the bottom of the page.