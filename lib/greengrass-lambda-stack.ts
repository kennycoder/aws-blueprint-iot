import cdk = require('@aws-cdk/core');
import lambda = require('@aws-cdk/aws-lambda');

export class GreengrassLambdaStack extends cdk.Stack {

    public readonly greengrassLambdaAlias: lambda.Alias;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Greengrass
        const greengrassLambda = new lambda.Function(this, 'GreengrassSampleHandler', {
            runtime: lambda.Runtime.PYTHON_3_7,
            code: lambda.Code.fromAsset('handlers'),
            handler: 'handler.lambda_handler',
            environment: {
                "AWS_IOT_THING_NAME": "Raspberry_Pi_Thing"
            }
        });
        const version = greengrassLambda.addVersion('GreengrassSampleVersion');

        // Greengrass Lambda
        this.greengrassLambdaAlias = new lambda.Alias(this, 'GreengrassSampleAlias', {
            aliasName: 'rasberrypi',
            version: version
        })
    }
}
