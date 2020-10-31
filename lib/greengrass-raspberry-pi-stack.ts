import cdk = require('@aws-cdk/core');
import iot = require('@aws-cdk/aws-iot');
import lambda = require('@aws-cdk/aws-lambda');
import greengrass = require('@aws-cdk/aws-greengrass');
import * as awssdk from 'aws-sdk';

interface GreengrassRaspberryPiStackProps extends cdk.StackProps {
  greengrassLambdaAlias: lambda.Alias
}

export class GreengrassRaspberryPiStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: GreengrassRaspberryPiStackProps) {
        super(scope, id, props);
        
        let context = this;
        let iot = new awssdk.Iot();

        // create a first certificate for GG
        iot.createKeysAndCertificate({setAsActive: true}, function(err, data) {
            if (err) { 
                console.log(err, err.stack); // an error occurred
            }
            else {
                console.log("Greengrass Certificate ID: \n", data.certificateId);           // successful response
                console.log("Greengrass Certificate: \n", data.certificatePem);           // successful response
                console.log("Greengrass Public key: \n", data.keyPair?.PublicKey);           // successful response
                console.log("Greengrass Private key: \n", data.keyPair?.PrivateKey);           // successful response
                if (data.certificateArn) {
                    let GreenGrassCertificateArn = data.certificateArn;

                    // create a second certificate for the sensor thing
                    iot.createKeysAndCertificate({setAsActive: true}, function(err, data) {
                        if (err) { 
                            console.log(err, err.stack); // an error occurred
                        }
                        else {
                            console.log("Sensor Device Certificate ID: \n", data.certificateId);           // successful response
                            console.log("Sensor Device Certificate: \n", data.certificatePem);           // successful response
                            console.log("Sensor Device Public key: \n", data.keyPair?.PublicKey);           // successful response
                            console.log("Sensor Device Private key: \n", data.keyPair?.PrivateKey);           // successful response
                            if (data.certificateArn) {
                                let ThingCertificateArn = data.certificateArn;
                                context.deployGreengrass(GreenGrassCertificateArn, ThingCertificateArn, props.greengrassLambdaAlias.functionArn);
                            }
                        }
                    });
                }
            }
        });
        
    }

    deployGreengrass(certArn: string, certSensorsArn: string, functionArn: string) {

        // const certArn: string = 'fill the certificate arn'
        const region: string = cdk.Stack.of(this).region;
        const accountId: string = cdk.Stack.of(this).account;

        // AWS IoT Thing for Core
        const iotThing = new iot.CfnThing(this, 'ThingCore', {
            thingName: 'Raspberry_Pi_Thing'
        });

        // AWS IoT Thing for sensors
        const iotThingSensors = new iot.CfnThing(this, 'ThingSensors', {
            thingName: 'Sensors_Pi_Thing'
        });

        if (iotThing.thingName !== undefined && iotThingSensors.thingName !== undefined) {
            
            const thingArn = `arn:aws:iot:${region}:${accountId}:thing/${iotThing.thingName}`;
            const thingSensorsArn = `arn:aws:iot:${region}:${accountId}:thing/${iotThingSensors.thingName}`;

            const iotPolicy = new iot.CfnPolicy(this, 'Policy', {
                policyName: 'IoT_Blueprint_Policy',
                policyDocument: {
                "Version": "2012-10-17",
                "Statement": [
                    {
                    "Effect": "Allow",
                    "Action": [
                        "iot:*",
                        "greengrass:*",
                    ],
                    "Resource": [
                        "*"
                    ]
                    }
                ]
                }
            });
            iotPolicy.addDependsOn(iotThing);
            iotPolicy.addDependsOn(iotThingSensors);

            if (iotPolicy.policyName !== undefined) {
                const policyGreenGrassPrincipalAttachment = new iot.CfnPolicyPrincipalAttachment(this, 'policyGreenGrassPrincipalAttachment', {
                policyName: iotPolicy.policyName,
                principal: certArn
                })
                policyGreenGrassPrincipalAttachment.addDependsOn(iotPolicy)

                const policySensorPrincipalAttachment = new iot.CfnPolicyPrincipalAttachment(this, 'policySensorPrincipalAttachment', {
                policyName: iotPolicy.policyName,
                principal: certSensorsArn
                })
                policySensorPrincipalAttachment.addDependsOn(iotPolicy)
            }

            const thingPrincipalAttachment = new iot.CfnThingPrincipalAttachment(this, 'ThingPrincipalAttachment', {
                thingName: iotThing.thingName,
                principal: certArn
            });
            thingPrincipalAttachment.addDependsOn(iotThing)

            const thingSensorsPrincipalAttachment = new iot.CfnThingPrincipalAttachment(this, 'ThingSensorsPrincipalAttachment', {
                thingName: iotThingSensors.thingName,
                principal: certSensorsArn
            });
            thingSensorsPrincipalAttachment.addDependsOn(iotThingSensors)

            // Greengrass Core
            const coreDefinition = new greengrass.CfnCoreDefinition(this, 'CoreDefinition', {
                name: 'Raspberry_Pi_Core',
                initialVersion: {
                cores: [
                    {
                    certificateArn: certArn,
                    id: '1',
                    thingArn: thingArn
                    }
                ]
                }
            });
            coreDefinition.addDependsOn(iotThing)

            // Sensors device
            const deviceDefinition = new greengrass.CfnDeviceDefinition(this, 'SensorsDeviceDefinition', {
                name: 'Sensors_Pi_Device',
                initialVersion: {
                    devices: [
                        {
                            thingArn: thingSensorsArn,
                            certificateArn: certSensorsArn,
                            id: '1',
                            syncShadow: false
                        }
                    ]
                }
            });

            // /dev/gpiomem resource
            const resourceDefinition = new greengrass.CfnResourceDefinition(this, 'ResourceDefinition', {
                name: 'Raspberry_Pi_Resource',
                initialVersion: {
                resources: [
                    {
                        id: 'gpio-resource-id',
                        name: 'gpio-resource',
                        resourceDataContainer: {
                            localDeviceResourceData: {
                                sourcePath: '/dev/gpiomem',
                                groupOwnerSetting: {
                                    autoAddGroupOwner: true
                                }
                            },

                        }
                    }
                ]
                }
            });

            // Gpio connector definition
            const gpioConnectorDefintion = new greengrass.CfnConnectorDefinition(this, 'gpioConnectorDefintion', {
                name: 'Raspberry_Pi_Connector',
                initialVersion: {
                    connectors: [
                        {
                            id: 'gpio-connector',
                            connectorArn: `arn:aws:greengrass:${region}::/connectors/RaspberryPiGPIO/versions/3`,
                            parameters: {
                                "GpioMem-ResourceId": "gpio-resource-id",
                                "InputGpios": "6D",
                                "InputPollPeriod": "50",
                                "OutputGpios": "8H"
                            }                            
                        }
                    ]
                }
            }
            );

            // Greengrass Lambda with resource access policy
            const functionDefinition = new greengrass.CfnFunctionDefinition(this, 'FunctionDefinition', {
                name: 'Raspberry_Pi_Function',
                initialVersion: {
                functions: [
                    {
                    id: '1',
                    functionArn: functionArn,
                    functionConfiguration: {
                        encodingType: 'binary',
                        memorySize: 65536,
                        pinned: true,
                        timeout: 3,
                        environment: {
                        resourceAccessPolicies: [
                            {
                            resourceId: 'gpio-resource-id',
                            permission: 'rw'
                            }
                        ]
                        }
                    }
                    }
                ]
                }
            });

            const GPIOSubscriptionToIoTCloudDefinition = new greengrass.CfnSubscriptionDefinition(this, 'GPIOSubscriptionToIoTCloudDefinition', {
                name: 'gpio-sub-to-cloud',
                initialVersion: {
                    subscriptions: [
                        {
                            id: '1',
                            source: `arn:aws:greengrass:${region}::/connectors/RaspberryPiGPIO/versions/3`,
                            subject: 'gpio/'+ iotThing.thingName + '/6/state', // 6 is the GPIO port defined in our connector
                            target: 'cloud',
                        },
                        {
                            id: '2',
                            source: 'cloud',
                            subject: 'gpio/'+ iotThing.thingName + '/6/read', // 6 is the GPIO port defined in our connector
                            target: `arn:aws:greengrass:${region}::/connectors/RaspberryPiGPIO/versions/3`
                        },
                        {
                            id: '3',
                            source: functionArn,
                            subject: 'gpio/'+ iotThing.thingName + '/6/read', // 6 is the GPIO port defined in our connector
                            target: `arn:aws:greengrass:${region}::/connectors/RaspberryPiGPIO/versions/3`,
                        },
                        {
                            id: '4',
                            source: thingSensorsArn,
                            subject: 'sensors/stm32_board_1/data',
                            target: 'cloud',
                        },                    ]
                }
            })

            // Greengrass
            const group = new greengrass.CfnGroup(this, 'Group', {
                name: 'Raspberry_Pi',
                initialVersion: {
                coreDefinitionVersionArn: coreDefinition.attrLatestVersionArn,
                resourceDefinitionVersionArn: resourceDefinition.attrLatestVersionArn,
                functionDefinitionVersionArn: functionDefinition.attrLatestVersionArn,
                deviceDefinitionVersionArn: deviceDefinition.attrLatestVersionArn,
                connectorDefinitionVersionArn: gpioConnectorDefintion.attrLatestVersionArn,
                subscriptionDefinitionVersionArn: GPIOSubscriptionToIoTCloudDefinition.attrLatestVersionArn
                }
            });

            // Definition
            group.addDependsOn(coreDefinition)
            group.addDependsOn(resourceDefinition)
            group.addDependsOn(functionDefinition)
            group.addDependsOn(gpioConnectorDefintion)
            group.addDependsOn(GPIOSubscriptionToIoTCloudDefinition)
            
        }
    }
}