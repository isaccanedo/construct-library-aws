/**
 * @license
 * Copyright Amazon LLC. All Rights Reserved.
 */
import {CfnFlowLog, DefaultInstanceTenancy, Vpc as CdkVpc} from '@aws-cdk/aws-ec2';
import {Construct} from '@aws-cdk/cdk';
import {PolicyStatement, Role, ServicePrincipal} from '@aws-cdk/aws-iam';
import {Trail} from '@aws-cdk/aws-cloudtrail';

export interface VpcProps {
  maxAZs?: number;
  enableFlowLogs?: boolean;
  enableCloudTrail?: boolean;
}

export class Vpc extends CdkVpc {
  constructor(scope: Construct, id: string, props?: VpcProps) {
    super(scope, id, {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAZs: props ? props.maxAZs : undefined,
      defaultInstanceTenancy: DefaultInstanceTenancy.Default,
    });

    if (props && props.enableFlowLogs) {
      const flowLogsRole = new Role(this, 'FlowLogsRole', {
        assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      });
      flowLogsRole.addToPolicy(new PolicyStatement()
        .addActions(
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents')
        .addAllResources());
      new CfnFlowLog(this, 'FlowLogs', {
        trafficType: 'all',
        resourceType: 'vpc',
        resourceId: this.vpcId,
        logGroupName: `VpcFlowLogs-${this.vpcId}`,
        deliverLogsPermissionArn: flowLogsRole.roleArn,
      });
    }

    if (props && props.enableCloudTrail) {
      new Trail(this, 'CloudTrail');
    }
  }
}
