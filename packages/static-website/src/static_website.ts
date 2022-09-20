/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {Construct} from '@aws-cdk/cdk';
import {CloudFrontWebDistribution} from '@aws-cdk/aws-cloudfront';
import {CfnRecordSet} from '@aws-cdk/aws-route53';
import {Bucket} from '@aws-cdk/aws-s3';

import {StaticWebsiteBucket} from './bucket';
import {StaticWebsiteCloudFront, StaticWebsiteCloudFrontProps} from './cloud_front';
import {ArtifactCopyConfiguration} from '../../artifacts/src/artifact_copy_configuration';


/**
 * Configuration you can specify for a Static Website.
 */
export interface StaticWebsiteProps {
  /**
   * Where to get the source artifacts from for your static website.
   */
  artifactCopyConfiguration: ArtifactCopyConfiguration;
  /**
   * DNS configuration for your static website, if needed.
   */
  route53?: {
    /**
     * The hosted zone name for your DNS (e.g. amazon.com).
     */
    hostedZoneName: string;
    /**
     * The record name for your static website (e.g. www).
     */
    recordName: string;
  };
  /**
   * CloudFront configuration, if needed.
   */
  cloudfront?: StaticWebsiteCloudFrontProps;
  /**
   * S3 configuration, if needed.
   */
  s3?: {
    /**
     * The file to use as the index document.
     * @default index.html
     */
    indexDocument?: string;
    /**
     * The file to use for 404 redirects, if any.
     */
    errorDocument?: string;
  };
}

/**
 * So you want to deploy a static website to AWS. To do this you have several options:
 * 1) Use S3 by itself, configured for static website hosting
 * 2) Use S3 with CloudFront (the AWS CDN)
 * 3) Use either of the above, and also add Route53 DNS registration
 *
 * Thankfully, all of those options are handled neatly in this one class. Based on the
 * options passed in to this class, we will neatly generate everything needed.
 *
 * If you specify s3 configuration, we will only create S3 resources.
 *
 * If you specify cloudfront configuration, we'll generate the S3 bucket and the CloudFront
 * distribution (as well as some other fancy CloudFront configuration you can pass in).
 *
 * If you specify route53 configuration in either case, we'll add DNS records for whichever
 * setup you want.
 *
 * To get rid of everything? Just delete the stack when you're done. Easy peasy.
 */
export class StaticWebsite extends Construct {

  readonly bucket: Bucket;
  readonly distribution?: CloudFrontWebDistribution;
  readonly route53ARecord?: CfnRecordSet;
  readonly route53AAAARecord?: CfnRecordSet;

  constructor(parent: Construct, name: string, props: StaticWebsiteProps) {
    super(parent, name);

    const bucket = new StaticWebsiteBucket(this, 'Bucket', {
      artifactCopyConfiguration: props.artifactCopyConfiguration,
      indexDocument: props.s3 ? props.s3.indexDocument || props.s3.errorDocument && 'index.html' : undefined,
      errorDocument: props.s3 ? props.s3.errorDocument : undefined,
    });
    const destPath = bucket.destPath;

    this.bucket = bucket;

    if (!props.s3 && props.cloudfront) {
      const cloudFront = new StaticWebsiteCloudFront(this, 'CloudFront', {
        bucket,
        destPath,
        dns: props.route53,
        ...props.cloudfront,
      });
      this.distribution = cloudFront;
      this.route53ARecord = cloudFront.route53ARecord;
      this.route53AAAARecord = cloudFront.route53AAAARecord;
    } else {
      if (props.route53) {
        this.route53ARecord = bucket.route53ARecord;
      }
    }
  }
}
