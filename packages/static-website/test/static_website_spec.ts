import {App, Stack} from '@aws-cdk/cdk';
import {haveResourceLike, ResourcePart, expect} from '@aws-cdk/assert';
import {CodeBuildWebsiteArtifactConfiguration} from '@constructs/artifacts';
import {StaticWebsite} from '@constructs/static-website';


describe('a CodeBuild website', () => {
  it('should generate a correct s3 bucket w/ policies', () => {
    const app = new App();
    const stackName = 'BONESStaticWebsite';
    const stack = new Stack(app, stackName);
    const bodeBuildConfig = new CodeBuildWebsiteArtifactConfiguration(stack);

    new StaticWebsite(stack, 'StaticWebsite', {
      artifactCopyConfiguration: bodeBuildConfig.websiteCopyConfiguration()
    });

    expect(stack).to(haveResourceLike('AWS::IAM::Policy', {
        'PolicyDocument': {
          'Statement': [
            {
              'Action': [
                's3:Get*',
                's3:List*',
                's3:Put*',
                's3:DeleteObject'
              ],
              'Effect': 'Allow',
              'Resource': [
                {
                  'Fn::GetAtt': [
                    'StaticWebsiteBucket6D9AD994',
                    'Arn'
                  ]
                },
                {
                  'Fn::Join': [
                    '',
                    [
                      {
                        'Fn::GetAtt': [
                          'StaticWebsiteBucket6D9AD994',
                          'Arn'
                        ]
                      },
                      '/*'
                    ]
                  ]
                }
              ]
            },
            {
              'Action': [
                's3:Get*',
                's3:List*'
              ],
              'Effect': 'Allow',
              'Resource': [
                {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        'Ref': 'AWS::Partition'
                      },
                      ':s3:::',
                      {
                        'Ref': 'CodeBuildBucket'
                      }
                    ]
                  ]
                },
                {
                  'Fn::Join': [
                    '',
                    [
                      'arn:',
                      {
                        'Ref': 'AWS::Partition'
                      },
                      ':s3:::',
                      {
                        'Ref': 'CodeBuildBucket'
                      },
                      '/*'
                    ]
                  ]
                }
              ]
            }
          ],
          'Version': '2012-10-17'
        },
        // tslint:disable-next-line
        'PolicyName': 'StaticWebsiteBucketGenericCopierCopyCustomResourceLambdaServiceRoleDefaultPolicy76FE9DBD',
        'Roles': [
          {
            // tslint:disable-next-line
            'Ref': 'StaticWebsiteBucketGenericCopierCopyCustomResourceLambdaServiceRoleABC135AA'
          }
        ]
    }, ResourcePart.Properties));
  })
});
