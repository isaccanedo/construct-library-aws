/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {CfnParameter, Construct, Stack} from '@aws-cdk/cdk';
import {Bucket, IBucket} from '@aws-cdk/aws-s3';
import {CfnFunction, Code, S3Code} from '@aws-cdk/aws-lambda';
import {CfnFunction as SamCfnFunction} from '@aws-cdk/aws-sam';

import {ArtifactCopyConfiguration, CopyMode} from './artifact_copy_configuration';


/**
 * Code Build Constants
 * CodeBuild is an external AWS Build fleet.
 * When used in a code pipeline - you can configure CodePipeline to tell your CloudFormation actions
 * to pass along parameters. Commonly - you'd (obviously) want to pass along the "BuildOutput"
 * (artifact locations from build)
 * These are the conventional paramter names you'd likely - some what reasonably want.
 * @internal
 */
export enum CodeBuildParams {
  CODE_BUILD_BUCKET_PARAM = 'CodeBuildBucket',
  CODE_BUILD_KEY_PARAM = 'CodeBuildKey'
}

export class CodeBuildArtifactLocationProvider {
  private readonly stack: Stack;
  private readonly importBucketName = 'CodeBuildBucketImport';

  constructor(readonly parent: Construct) {
    this.stack = parent.node.stack;
  }

  bucket() {
    const existing = this.stack.node.tryFindChild(this.importBucketName);
    if (existing) {
      return existing as IBucket;
    }
    const param = new CfnParameter(this.parent, CodeBuildParams.CODE_BUILD_BUCKET_PARAM,
      { type: 'String' });
    return Bucket.fromBucketName(this.stack, this.importBucketName, param.ref);
  }

  key() {
    const existing = this.stack.node.tryFindChild(CodeBuildParams.CODE_BUILD_KEY_PARAM);
    if (existing) {
      return existing as CfnParameter;
    }
    return new CfnParameter(this.parent, CodeBuildParams.CODE_BUILD_KEY_PARAM,
      { type: 'String' });
  }
}

export class CodeBuildLambdaArtifactConfiguration implements ILambdaCodeProvider {
  private readonly codeBuildLocationProvider: CodeBuildArtifactLocationProvider;

  constructor(readonly parent: Construct) {
    this.codeBuildLocationProvider = new CodeBuildArtifactLocationProvider(parent);
  }

  lambdaCode(): CfnFunction.CodeProperty {
    return {
      s3Bucket: this.codeBuildLocationProvider.bucket().bucketName,
      s3Key: this.codeBuildLocationProvider.key().ref,
    };
  }
  serverlessCode(): SamCfnFunction.S3LocationProperty {
    return {
      bucket: this.codeBuildLocationProvider.bucket().bucketName,
      key: this.codeBuildLocationProvider.key().ref,
    };
  }

  code(): Code {
    return new S3Code(this.codeBuildLocationProvider.bucket(),
      this.codeBuildLocationProvider.key().ref);
  }
}

/**
 * Artifact providers for Lambda need to work in both a "serverless" and "non serverless" mode.
 * Sigh. (In the CfnSpec - when using the serverless lambda vs a direct lambda - they're
 * different keys)
 * This is just an interface that forces both return types.
 */
export interface ILambdaCodeProvider {
  lambdaCode(): CfnFunction.CodeProperty;
  serverlessCode(): SamCfnFunction.S3LocationProperty;
  code(): Code;
}

/**
 * A simple interface to provide web related assets.
 */
export interface IWebsiteArtifactProvider {
  websiteCopyConfiguration(): ArtifactCopyConfiguration;
}

export class CodeBuildWebsiteArtifactConfiguration implements IWebsiteArtifactProvider {
  private readonly codeBuildLocationProvider: CodeBuildArtifactLocationProvider;

  constructor(readonly parent: Construct,
              readonly subfolder = 'website/build/',
              readonly settings?: {[key: string]: string}) {
    this.codeBuildLocationProvider = new CodeBuildArtifactLocationProvider(parent);
  }

  websiteCopyConfiguration(): ArtifactCopyConfiguration {
    return {
      copyMode: CopyMode.ROOT,
      sourceBucket: this.codeBuildLocationProvider.bucket(),
      sourceKey: this.codeBuildLocationProvider.key().ref,
      zipSubfolder: this.subfolder,
      settings: this.settings
    };
  }
}
