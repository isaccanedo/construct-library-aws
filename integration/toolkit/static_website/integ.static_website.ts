import {App, Stack} from '@aws-cdk/cdk';
import {StaticWebsite} from '@amzn/static-website';

import {LocalAssetWebsiteProvider} from './local_assets';


const app = new App();
const stack = new Stack(app, 'bones-static-website');

new StaticWebsite(stack, 'StaticWebsite', {
  artifactCopyConfiguration: new LocalAssetWebsiteProvider(stack).websiteCopyConfiguration()
});

app.run();
