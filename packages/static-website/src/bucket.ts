/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {Construct, Fn} from '@aws-cdk/cdk';
import {Bucket} from '@aws-cdk/aws-s3';
import {AccountRootPrincipal, PolicyStatement} from '@aws-cdk/aws-iam';
import {CfnRecordSet} from '@aws-cdk/aws-route53';
import {BucketDeployment, Source} from '@aws-cdk/aws-s3-deployment';
import {ArtifactCopyConfiguration} from '@constructs/artifacts';


/** @internal */
export interface StaticWebsiteBucketProps {
  artifactCopyConfiguration: ArtifactCopyConfiguration;
  indexDocument?: string;
  errorDocument?: string;
  dns?: {
    hostedZoneName: string;
    recordName?: string;
  }
}

/** @internal */
export class StaticWebsiteBucket extends Bucket {
  readonly destPath: string;
  readonly route53ARecord?: CfnRecordSet;

  constructor(parent: Construct, name: string, props: StaticWebsiteBucketProps) {
    super(parent, name, {
      websiteIndexDocument: props.indexDocument,
      websiteErrorDocument: props.errorDocument,
      publicReadAccess: !!props.indexDocument,
      bucketName: props.dns ?
        `${props.dns.recordName || ''}${props.dns.recordName ? '.' : ''}${props.dns.hostedZoneName}` : undefined,
    });

    if (props.dns) {
      // TODO: add www redirect
      // new Bucket(this, 'RedirectWWW', {
      //   bucketName: '',
      //   publicReadAccess: true,
      // });

      const route53CommonProps = {
        // TODO: fix this
        // aliasTarget: {
        //   dnsName: this.distribution.domainName,
        //   hostedZoneId: this.distribution.aliasHostedZoneId,
        // },
        hostedZoneName: Fn.sub('${HZName}.', {HZName: props.dns.hostedZoneName}),
        name: props.dns.recordName ?
          `${props.dns.recordName}.${props.dns.hostedZoneName}` : props.dns.hostedZoneName,
      };
      this.route53ARecord = new CfnRecordSet(this, 'Record', {
        ...route53CommonProps,
        type: 'A'
      });
    }

    this.addToResourcePolicy(
      new PolicyStatement()
        .addActions('s3:*')
        .addPrincipal(new AccountRootPrincipal())
        .addResource(this.arnForObjects('*'))
    );

    const injectArtifacts: {[key: string]: any} = {};
    if (props.artifactCopyConfiguration.injectedArtifacts &&
      props.artifactCopyConfiguration.injectedArtifacts.length > 0) {
      props.artifactCopyConfiguration.injectedArtifacts.forEach(artifact => {
        injectArtifacts[artifact.path] = artifact.content;
      });
    }

    if (props.artifactCopyConfiguration.settings) {
      injectArtifacts['settings.json'] = props.artifactCopyConfiguration.settings;
    }

    // TODO: make it so this accepts local resources too
    const bucketDeployment = new BucketDeployment(this, 'DeploymentBucket', {
      source: Source.bucket(props.artifactCopyConfiguration.sourceBucket, props.artifactCopyConfiguration.sourceKey || ''),
      destinationBucket: this,
    });

    // Copy in the original resources into the dedicated bucket
    // const copier = new GenericCopy(this, 'GenericCopier', {
    //   copyMode: props.artifactCopyConfiguration.copyMode || CopyMode.SUBFOLDER,
    //   destBucket: this.bucket,
    //   sourceBucket: props.artifactCopyConfiguration.sourceBucket,
    //   sourceKey: props.artifactCopyConfiguration.sourceKey || '',
    //   sourceKeyIsZipped: !!props.artifactCopyConfiguration.zipSubfolder,
    //   zipSubfolder: props.artifactCopyConfiguration.zipSubfolder,
    //   injectArtifacts,
    //   policyStatements: props.artifactCopyConfiguration.policyStatements,
    //   additionalPolicyStatements: props.artifactCopyConfiguration
    //     .additionalPolicyStatements,
    // });

    // this.destPath = copier.destPath;
    // TODO: is this right?
    this.destPath = '/';
  }
}
