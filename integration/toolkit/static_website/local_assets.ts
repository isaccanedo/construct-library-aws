import {Construct} from '@aws-cdk/cdk';
import {Asset, ZipDirectoryAsset} from '@aws-cdk/assets';
import {CfnFunction as SamCfnFunction} from '@aws-cdk/aws-sam';
import {Bucket} from '@aws-cdk/aws-s3';
import {CfnFunction, Code, S3Code} from '@aws-cdk/aws-lambda';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {ArtifactCopyConfiguration, ILambdaCodeProvider, IWebsiteArtifactProvider} from '@amzn/static-website';


function assetForFolder(folderBaseName: string, parent: Construct): Asset {
  const path = findTestFolder(folderBaseName);
  const hash = crypto.createHash('sha1');
  const hashString = hash.digest('hex');
  return new ZipDirectoryAsset(parent, `IntegAssets-${hashString}`, {path});
}

/**
 * Sometimes, when you're running in brazil, paths are weird.
 * Figure out the path the smart way.
 */
export function findTestFolder(folderBaseName: string): string {
  return fs.existsSync(`./test/${folderBaseName}`) ?
    `./test/${folderBaseName}` : `./${folderBaseName}`;
}

export class LocalAssetWebsiteProvider implements IWebsiteArtifactProvider {
  private readonly asset: Asset;
  constructor(readonly parent: Construct) {
    this.asset = assetForFolder('integ-assets', parent);
  }

  websiteCopyConfiguration(): ArtifactCopyConfiguration {
    return {
      sourceBucket: Bucket.fromBucketName(this.parent, 'AssetBucket', this.asset.s3BucketName),
      sourceKey: this.asset.s3ObjectKey,
      zipSubfolder: '/',
    };
  }
}

export class LocalAssetLambdaProvider implements ILambdaCodeProvider {
  private readonly asset: Asset;
  constructor(readonly parent: Construct) {
    this.asset = assetForFolder('integ-lambda-assets', parent);
  }

  lambdaCode(): CfnFunction.CodeProperty {
    return {
      s3Bucket: this.asset.s3BucketName,
      s3Key: this.asset.s3ObjectKey
    };
  }

  serverlessCode(): SamCfnFunction.S3LocationProperty {
    return {
      bucket: this.asset.s3BucketName,
      key: this.asset.s3ObjectKey,
    };
  }

  code(): Code {
    const name = 'ImportedCodeBuildBucket';
    const bucket = this.parent.node.tryFindChild(name) ?
      this.parent.node.findChild(name) as Bucket :
      Bucket.fromBucketName(this.parent, name, this.asset.s3BucketName);
    return new S3Code(bucket, this.asset.s3ObjectKey);
  }

}
