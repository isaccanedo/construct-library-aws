/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {CfnRecordSet} from '@aws-cdk/aws-route53';
import {FederatedPrincipal, PolicyStatement, Role} from '@aws-cdk/aws-iam';
import {Construct, Fn, Token} from '@aws-cdk/cdk';
import {CfnIdentityPool, CfnIdentityPoolRoleAttachment} from '@aws-cdk/aws-cognito';
import {CfnBasePathMapping, CfnDomainName, CfnDomainNameProps, EndpointType} from '@aws-cdk/aws-apigateway';
import {StaticWebsite, StaticWebsiteProps} from '@constructs/static-website';

export interface ServerlessWebAppProps {
  apiGateway: unknown;
  dns: unknown;
  identityProvider: unknown;
  cloudFront: unknown;
}


export class ServerlessWebapp extends Construct {
  readonly apiEndpoint: string;
  readonly apiId: string;
  readonly cognitoAuthenticatedRole: Role;
  readonly cognitoPool: CfnIdentityPool;

  constructor(parent: Construct, name: string, props: ServerlessWebAppProps) {
    super(parent, name);

    this.apiId = props.apiGateway.ref;
    let apigDomain;
    const stack = parent.node.stack;
    const stage = new Token({Ref: `${props.apiGateway.logicalId}.Stage`});

    /**
     * I made DNS optional - in quite a few cases - you actually don't need it.
     * It's only really when the IDP does whitelisting that won't allow CloudFront Domains
     *
     * (#midway)
     */
    if (props.dns) {
      const apiRecordName = props.dns.apiRecordName ? props.dns.apiRecordName : 'api';
      this.apiEndpoint = `${apiRecordName}.${props.dns.hostedZoneName}`;
      const endpointType = props.dns.apiGatewayType || EndpointType.Regional;

      let apigDomainConfig: CfnDomainNameProps;

      const thisCert = new ACMDNSCert(this, `APIGCert${endpointType}`, {
        // the compiler thinks props.dns could be undefined here...
        hostedZoneName: props.dns!.hostedZoneName,
        recordName: apiRecordName,
        // In edge mode - we must fix the cert location to us-east-1 { cloudFront }
        region: endpointType === EndpointType.Edge ? 'us-east-1' : stack.region
      });
      // Depending on the endpoint type, APIG will pass/needs differnet values.
      if (endpointType === EndpointType.Edge) {
        apigDomainConfig = {
          domainName: this.apiEndpoint,
          endpointConfiguration: {
            types: [endpointType]
          },
          certificateArn: thisCert.certArn,
        };
      } else {
        apigDomainConfig = {
          domainName: this.apiEndpoint,
          endpointConfiguration: {
            types: [endpointType]
          },
          regionalCertificateArn: thisCert.certArn,
        };
      }
      apigDomain = new CfnDomainName(this, 'APIGDNS', apigDomainConfig);
      new CfnBasePathMapping(this, 'APIGMapping', {
        basePath: '',
        stage: this.node.resolve(stage),
        domainName: apigDomain.ref,
        restApiId: props.apiGateway.ref,
      });

      const apigRoute53RecordCommonProps = {
        hostedZoneName: `${props.dns.hostedZoneName}.`,
        name: this.apiEndpoint,
        aliasTarget: this.route53AliasFromAPIGDomain(apigDomain as CfnDomainName,
          endpointType),
      };

      ['A', 'AAAA'].forEach(recordType => {
        new CfnRecordSet(this, `APIGRecord${recordType}`, {
          ...apigRoute53RecordCommonProps,
          type: recordType
        });
      });

    } else {
      this.apiEndpoint = Fn.sub(
        'https://${API_ID}.execute-api.${AWS::Region}.amazonaws.com/${STAGE}',
        {
          API_ID: props.apiGateway.ref,
          STAGE: this.node.resolve(stage),
        }
      ).toString();
    }

    this.cognitoPool = new CfnIdentityPool(this, 'IdentityPool', {
      ...props.identityProvider.identityPoolConfiguration
    });

    this.cognitoAuthenticatedRole = new Role(this, 'AuthedRole', {
      assumedBy:
        new FederatedPrincipal('cognito-identity.amazonaws.com',
          {
            'StringEquals': {
              'cognito-identity.amazonaws.com:aud': this.cognitoPool.ref
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated'
            }
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
    });

    new CfnIdentityPoolRoleAttachment(this, 'RoleAttachment', {
      identityPoolId: this.cognitoPool.ref,
      roles: {
        authenticated: this.cognitoAuthenticatedRole.roleArn,
      },
    });

    this.cognitoAuthenticatedRole.addToPolicy(new PolicyStatement()
      .addAction('execute-api:Invoke')
      .addResource(
        Fn.sub(
          // tslint:disable-next-line
          'arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${LambdaApiId}/${LambdaApiStage}/*',
          {LambdaApiId: this.apiId, LambdaApiStage: this.node.resolve(stage)}
        ).toString()
      )
    );

    if (!props.cloudFront.artifactCopyConfiguration.settings) {
      props.cloudFront.artifactCopyConfiguration.settings = {};
    }

    props.cloudFront.artifactCopyConfiguration.settings = {
      ...props.cloudFront.artifactCopyConfiguration.settings,
      apiEndpoint: this.apiEndpoint,
      cognitoPoolId: this.cognitoPool.identityPoolId,
      region: stack.region
    };

    const staticWebProps: StaticWebsiteProps = {
      website: props.cloudFront
    };

    if (props.dns) {
      staticWebProps.dns = {
        hostedZoneName: props.dns.hostedZoneName,
        recordName: props.dns.websiteRecordName
      };
    }

    new StaticWebsite(this, 'NMWWebsite', staticWebProps);
  }

  // tslint:disable-next-line:max-line-length
  private route53AliasFromAPIGDomain(apigDomain: CfnDomainName, endpointType: EndpointType): CfnRecordSet.AliasTargetProperty {
    if (endpointType === EndpointType.Edge) {
      return {
        dnsName: apigDomain.domainNameDistributionDomainName,
        hostedZoneId: apigDomain.domainNameDistributionHostedZoneId,
      };
    } else {
      return {
        dnsName: apigDomain.domainNameRegionalDomainName,
        hostedZoneId: apigDomain.domainNameRegionalHostedZoneId,
      };
    }
  }
}
