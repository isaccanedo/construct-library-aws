/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {Bucket} from '@aws-cdk/aws-s3';
import {
  Behavior,
  CfnCloudFrontOriginAccessIdentity,
  CfnDistribution,
  CloudFrontAllowedMethods,
  CloudFrontWebDistribution,
  CloudFrontWebDistributionProps,
  HttpVersion,
  PriceClass,
  SourceConfiguration,
  ViewerProtocolPolicy,
} from '@aws-cdk/aws-cloudfront';
import {Construct, Fn} from '@aws-cdk/cdk';
import {CfnRecordSet} from '@aws-cdk/aws-route53';
import {CanonicalUserPrincipal, PolicyStatement} from '@aws-cdk/aws-iam';

import {StaticWebsiteCloudFrontDNS, StaticWebsiteCloudFrontDNSProps} from './dns';
import {CloudFrontInvalidate} from './cloudfront_invalidate';


/**
 * Configuration for a CloudFront distribution.
 */
export interface StaticWebsiteCloudFrontProps {
  behaviors?: Behavior[];
  priceClass?: PriceClass;
  /**
   * The default file for your distribution.
   * @default index.html
   */
  defaultFile?: string;
  /**
   * List of files to invalidate on each distribution update
   */
  invalidationPaths?: string[];
  originConfigs?: SourceConfiguration[];
  errorConfigurations?: CfnDistribution.CustomErrorResponseProperty[];
  /**
   * Whether to treat the application as a SPA (Single Page Webapp). This
   * adds a 404 redirect handler that redirects back to the index file
   * @default false
   */
  singlePageWebapp?: boolean;
}

/** @internal */
export interface IStaticWebsiteCloudFrontProps extends StaticWebsiteCloudFrontProps {
  bucket: Bucket;
  destPath: string;
  dns?: StaticWebsiteCloudFrontDNSProps;
}

/** @internal */
export class StaticWebsiteCloudFront extends CloudFrontWebDistribution {
  readonly route53ARecord?: CfnRecordSet;
  readonly route53AAAARecord?: CfnRecordSet;

  constructor(scope: Construct, id: string, props: IStaticWebsiteCloudFrontProps) {
    const originAccessIdentity = new CfnCloudFrontOriginAccessIdentity(scope, 'OAI', {
      cloudFrontOriginAccessIdentityConfig: {
        comment: 'OAI'
      }
    });

    const s3UserId = originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId;

    props.bucket.addToResourcePolicy(
      new PolicyStatement()
        .addActions('s3:GetObject')
        .addPrincipal(new CanonicalUserPrincipal(s3UserId))
        .addResource(props.bucket.arnForObjects('*'))
    );

    props.bucket.addToResourcePolicy(
      new PolicyStatement()
        .addActions('s3:ListBucket')
        .addPrincipal(new CanonicalUserPrincipal(s3UserId))
        .addResource(props.bucket.bucketArn)
    );

    const resolvedDefaultFile = props.defaultFile || 'index.html';
    if (resolvedDefaultFile.startsWith('/')) {
      throw new Error(`Default file cannot start with a /. Got ${resolvedDefaultFile}`);
    }

    const errorConfigurations: CfnDistribution.CustomErrorResponseProperty[] = [];
    if (props.errorConfigurations) {
      errorConfigurations.push(...props.errorConfigurations);
    }

    if (props.singlePageWebapp) {
      // but error pages to start with a '/' idk
      errorConfigurations.push({
        errorCode: 404,
        responseCode: 200,
        responsePagePath: `/${resolvedDefaultFile}`,
      });
    }

    const originConfigs: SourceConfiguration[] = (props.originConfigs || [])
      .map((config) => {
        let fixedConfig = {...config};
        if (!fixedConfig.s3OriginSource && !fixedConfig.customOriginSource) {
          fixedConfig.s3OriginSource = {
            originAccessIdentityId: originAccessIdentity.cloudFrontOriginAccessIdentityId,
            s3BucketSource: props.bucket,
          };
          fixedConfig.originPath = props.destPath + config.originPath;
        }
        return fixedConfig as SourceConfiguration;
      });

    originConfigs.push(
      {
        s3OriginSource: {
          originAccessIdentityId: originAccessIdentity.cloudFrontOriginAccessIdentityId,
          s3BucketSource: props.bucket,
        },
        behaviors: props.behaviors ? props.behaviors : [
          {
            isDefaultBehavior: true,
            allowedMethods: CloudFrontAllowedMethods.GET_HEAD_OPTIONS,
            compress: true,
          }
        ],
        originPath: props.destPath
      });

    const defaultProps: CloudFrontWebDistributionProps = {
      // tslint:disable
      // Enter only the object name, for example, index.html. Do not add a / before the object name.
      // per: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DefaultRootObject.html
      // tslint:enable
      defaultRootObject: resolvedDefaultFile,
      enableIpV6: true,
      httpVersion: HttpVersion.HTTP2,
      viewerProtocolPolicy: ViewerProtocolPolicy.RedirectToHTTPS,
      priceClass: props.priceClass || PriceClass.PriceClass100,
      originConfigs,
      errorConfigurations,
    };

    if (props.dns) {
      const dns = new StaticWebsiteCloudFrontDNS(scope, 'DNS', props.dns);
      const aliasConfiguration = dns.aliasConfiguration;

      super(scope, id, {...defaultProps, aliasConfiguration});

      const route53CommonProps = {
        aliasTarget: {
          dnsName: this.domainName,
          hostedZoneId: dns.hostedZoneId,
        },
        hostedZoneName: Fn.sub('${HZName}.', {HZName: props.dns.hostedZoneName}),
        name: props.dns.recordName ?
          `${props.dns.recordName}.${props.dns.hostedZoneName}` : props.dns.hostedZoneName,
      };
      this.route53ARecord = new CfnRecordSet(this, 'Record', {
        ...route53CommonProps,
        type: 'A'
      });
      this.route53AAAARecord = new CfnRecordSet(this, 'AAAARecord', {
        ...route53CommonProps,
        type: 'AAAA'
      });
    } else {
      super(scope, id, defaultProps);
    }

    if (props.invalidationPaths) {
      new CloudFrontInvalidate(this, 'CloudFrontInvalidate', {
        distributionId: this.distributionId,
        invalidationPaths: props.invalidationPaths
      });
    }
  }
}
