#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { GreengrassRaspberryPiStack } from '../lib/greengrass-raspberry-pi-stack';
import { GreengrassLambdaStack } from '../lib/greengrass-lambda-stack';

const app = new cdk.App();

const lambdaStack = new GreengrassLambdaStack(app, 'GreengrassLambdaStack');
new GreengrassRaspberryPiStack(app, 'GreengrassRasberryPiStack', {
    greengrassLambdaAlias: lambdaStack.greengrassLambdaAlias
});