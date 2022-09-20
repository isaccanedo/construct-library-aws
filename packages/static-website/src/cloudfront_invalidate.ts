/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {Construct} from '@aws-cdk/cdk';
import {Code, Runtime, SingletonFunction} from '@aws-cdk/aws-lambda';
import {PolicyStatement} from '@aws-cdk/aws-iam';
import {CustomResource} from '@aws-cdk/aws-cloudformation';
import * as path from 'path';


/** @internal */
export interface CloudFrontInvalidateProps {
  /**
   * The path of the objects to issue an invalidation.
   *
   * @default "/*"
   */
  readonly invalidationPaths?: string[];

  readonly distributionId: string;
}

/** @internal */
export class CloudFrontInvalidate extends Construct {
  constructor(parent: Construct, name: string, props: CloudFrontInvalidateProps) {
    super(parent, name);
    const lambda = new SingletonFunction(this, 'CloudFrontInvalidateLambda', {
      code: Code.asset(path.join(__dirname, 'resources')),
      handler: 'invalidate.main',
      timeout: 900,
      memorySize: 512,
      runtime: Runtime.Python36,
      initialPolicy: [
        new PolicyStatement().addResource('*').addActions('cloudfront:CreateInvalidation')
      ],
      uuid: 'ea8342bb-056e-431a-808d-a043d7d4a069',
      lambdaPurpose: 'InvalidateArtifacts',
    });

    new CustomResource(this, 'InvalidateCustomResource', {
      provider: {serviceToken: lambda.functionArn},
      properties: {
        InvalidationPaths: props.invalidationPaths ? props.invalidationPaths.join(',') : '/*',
        DistributionId: props.distributionId
      }
    });
  }
}
