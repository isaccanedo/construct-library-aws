/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {Construct} from '@aws-cdk/cdk';
import {AliasConfiguration} from '@aws-cdk/aws-cloudfront';
import {DnsValidatedCertificate} from '@aws-cdk/aws-certificatemanager';
import {HostedZoneProvider} from '@aws-cdk/aws-route53';


/** @internal */
export interface StaticWebsiteCloudFrontDNSProps {
  hostedZoneName: string;
  recordName?: string;
}

/** @internal */
export class StaticWebsiteCloudFrontDNS extends Construct {
  readonly aliasConfiguration: AliasConfiguration;
  readonly hostedZoneId: string;

  constructor(scope: Construct, id: string, props: StaticWebsiteCloudFrontDNSProps) {
    super(scope, id);

    const hostedZoneName = props.hostedZoneName;
    const recordName = props.recordName;

    const hostedZone = new HostedZoneProvider(this, {
      domainName: hostedZoneName,
      privateZone: false
    }).findAndImport(this, 'HostedZone');

    this.hostedZoneId = hostedZone.hostedZoneId;

    const certificate = new DnsValidatedCertificate(this, 'WebsiteCert', {
      hostedZone,
      domainName: `${recordName}.${hostedZoneName}`,
    });

    this.aliasConfiguration = {
      acmCertRef: certificate.certificateArn,
      names: recordName ? [`${recordName}.${hostedZoneName}`] : [hostedZoneName],
    };
  }
}
