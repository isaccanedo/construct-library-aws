/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {PolicyStatement} from '@aws-cdk/aws-iam';
import {IBucket} from '@aws-cdk/aws-s3';
import {Token} from '@aws-cdk/cdk';

export enum CopyMode {
  SUBFOLDER,
  ROOT,
}


/**
 * An artifact copy configuration is used to tell us how to copy artifacts.
 * We use this in the static website to copy from a source (typically, produced by your build)
 * to a destination.
 *
 * We have some pre-built implementations in the artifact_providers.ts file.
 */
export interface ArtifactCopyConfiguration {
  /**
   * Configuration that we should write to `settings.json` at the root of this distribution.
   * Settings should be JSON serializable.
   *
   * This is useful to embed runtime specific configuration into a distribution.
   * Typical examples include backend API endpoint configuration, or region/stage specifcic data.
   *
   * Ex: If you were to set the following for settings:
   *
   * settings: {
   *   apiEndpoint: "api.foo.example.com"
   * }
   *
   * This would result in a new file at the root of your CloudFront Distribution named
   * 'settings.json'
   * with the following content:
   *
   * {
   *   "apiEndpoint": "api.foo.example.com"
   * }
   *
   * A JS Client could fetch this file and use it configure itself.
   * @default none
   */
  settings?: {[key: string]: string | Token};

  /**
   * The source bucket to copy from.
   */
  sourceBucket: IBucket;

  /**
   * The source key to copy from.
   * If omitted - we will copy from the root of the given source bucket.
   *
   * @default /
   */
  sourceKey?: string;

  /**
   * If the source key above is a "zip" file, we'll unpack it, and use any settings.
   * This is only value used if the @field sourceKey is also specified.
   *
   * The presence of this key also denotes the source is zipped.
   * Pass '.' to indicate zipped but all assets in the zip.
   *
   * @default none
   */
  zipSubfolder?: string;

  /**
   * How the copier copies artifacts from the source to the destination.
   * The copy mode tells us where in the destination bucket to copy to.
   *
   * In "ROOT" mode - the copier will copy from the source to the destination bucket - but
   * into the root.
   * Any additional artifacts that were already in the root will not be touched. It's effectively
   * an "add only" copy.
   *
   * In "SUBFOLDER" mode - the copier will create a specific folder for a given copy and copy
   * artifacts into that subfolder.
   * The subfolder will subsequently be updated as the origin path in your CloudFront
   * distribution.
   * This has the effect of ensuring only the artifacts from this particular copy are
   * served by CloudFront.
   *
   * @default SUBFOLDER
   */
  copyMode?: CopyMode;

  /**
   * During the copy, if there are additional artifacts that need to be injected into the
   * CloudFront distribution, this is the place.
   *
   * @default none
   */
  injectedArtifacts?: InjectedArtifact[];

  /**
   * Policy configuration - for the generic copier we use for the website.
   *
   * Setting this will override all discovered properties of the copier.
   * Most people should opt to use the additionalPolicyStatements property
   */
  policyStatements?: PolicyStatement[];

  /**
   * Additional policy statements
   *
   * For appending additional permissions to the generic copier.
   * This is ignored if policyStatements is set.
   */
  additionalPolicyStatements?: PolicyStatement[];
}

export interface InjectedArtifact {
  /**
   * The relative path we should put the content into.
   */
  path: string;

  /**
   * The content to inject.
   */
  content: string;
}
