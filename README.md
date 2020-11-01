# Data ingestion blueprint overview

The goal of this blueprint is to show how sensor data can be ingested into AWS Cloud from low powered edge devices through AWS Greengrass Core device. This blueprint is part of the series that will explain how to analyze ingested data for implementing predictive maintenance pipelines.

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/stm32-gg-iotcore-diagram.png)

Parts used in this example:

- https://www.st.com/en/evaluation-tools/b-l475e-iot01a.html
- https://www.raspberrypi.org/products/raspberry-pi-zero-w/
- https://www.dfrobot.com/product-78.html
- MicroUSB cable, OTG MicroUSB cable, Mini HDMI to HMI cable. 
- 64GB microSD card

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/1604241530429.jpg)


STM32 board running FreeRTOS is responsible for sending sensor data through AWS Greengrass to Amazon IoT Core. It uses Greengrass Discovery RESTFul API to connect to a local Greengrass device via local network. This way your devices only send the data through Greengrass instead of direct conneciton to AWS Iot Core.

AWS Greengrass core has a simple touch sensor connected to a GPIO port. A Lambda function is running that triggers reading state of the GPIO port and publishes the status to a dedicated topic. The purpose is to demonstrate that devices running AWS Greengrass software can also interact with locally attached resources and publish the data to the cloud.

# Setting up your environment with AWS CDK

Before you start installing software and flashing your devices, you need to set up the environment in your AWS account. The setup consists of the following steps:

1. Create AWS Greengrass Group
2. Create AWS Greengrass Core
3. Create a device representation (STM32 board) associated to previously created AWS Greengrass group
4. Create a local resource to access GPIO on the AWS Greengrass device and a connector that provides built-in integration with services, protocols, or infrastructure.
5. Generate certificates for AWS Greengrass Core and STM32 board
6. Create subscriptions and topics between edge devices and AWS services for data ingestion.

All these steps are implemented inside this repository via AWS CDK.

To start please make sure that your environment has AWS CDK with Typescript installed. For more information, please follow the official documentation:

[https://docs.aws.amazon.com/cdk/latest/guide/getting\_started.html](https://docs.aws.amazon.com/cdk/latest/guide/getting_started.html)

[https://docs.aws.amazon.com/cdk/latest/guide/work-with-cdk-typescript.html](https://docs.aws.amazon.com/cdk/latest/guide/work-with-cdk-typescript.html)

Once everything is ready, clone this repository and run _cdk deploy_ command. Please note the output of the command since it contains the certificates and keys generated for both AWS Greengrass and STM32 board. Save the output to 6 separate files like for example:

- greengrass-raspberry.cert.pem
- greengrass-raspberry.private.key
- greengrass-raspberry.public.key

- stm32-board.cert.pem
- stm32-board.private.key
- stm32-board.public.key

We will need them in the next steps.

Now we can verify if everything is successfully deployed inside our AWS Management Console.

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/groups.png)

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/cores.png)

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/subs.png)

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/settings.png)

# Setting up AWS IoT Greengrass

For this blueprint we will be using a Rasberry Pi Zero W. It&#39;s an entry level Raspberry Pi with wireless LAN and Bluetooth, priced at only $10.

First we need an empty microSD card with enough storage for the latest Raspberry Pi OS. It can be downloaded from the official website here: [https://www.raspberrypi.org/downloads/raspberry-pi-os/](https://www.raspberrypi.org/downloads/raspberry-pi-os/)

For detailed instructions on how to set up Raspberry Pi with AWS IoT Greengrass please use the official documentation from here: [https://docs.aws.amazon.com/greengrass/latest/developerguide/setup-filter.rpi.html](https://docs.aws.amazon.com/greengrass/latest/developerguide/setup-filter.rpi.html)

To continue with our demo, you need to confirm that you have the [RPi.GPIO](https://sourceforge.net/p/raspberry-gpio-python/wiki/Home/) module installed on the Raspberry Pi.

Now you need to download AWS IoT Greengrass Core software on your core device. Please get the lastest version for your architecture here: [https://docs.aws.amazon.com/greengrass/latest/developerguide/what-is-gg.html#gg-core-download-tab](https://docs.aws.amazon.com/greengrass/latest/developerguide/what-is-gg.html#gg-core-download-tab)

sudo tar -xzvf greengrass-linux-_ **architecture** _-1.11.0.tar.gz -C /

This command will extract Greengrass core software to /greengrass folder on your core device.

Next you need put the certificates from the first step to /greengrass/certs folder. You could either do a network copy or just create three files with your favorite editor like _vi_ or _nano_ and paste the contents inside. Now you should have the following files on your core device:

- /greengrass/certs/greengrass-raspberry.cert.pem
- /greengrass/certs/greengrass-raspberry.private.key
- /greengrass/certs/greengrass-raspberry.public.key

/greengrass/certs/root.ca.pem (to get this file run the following command: _sudo wget -O root.ca.pem_ [_https://www.amazontrust.com/repository/AmazonRootCA1.pem_](https://www.amazontrust.com/repository/AmazonRootCA1.pem) inside /greengrass/certs folder)

As a last configuration step, you need to create a configuration file. You can use the following template:

```
{
  "coreThing" : {
    "caPath" : "root.ca.pem",
    "certPath" : "greengrass-raspberry.cert.pem",
    "keyPath" : "greengrass-raspberry.private.key",
    "thingArn" : "arn:aws:iot:REGION:YOUR_ACCOUNT_ID:thing/Raspberry_Pi_Thing",
    "iotHost" : "YOUR_ENDPOINT_FROM_IOT_CORE.iot.eu-central-1.amazonaws.com",
    "ggHost" : "greengrass-ats.iot.REGION.amazonaws.com",
    "keepAlive" : 600
  },
  "runtime" : {
    "cgroup" : {
      "useSystemd" : "yes"
    }
  },
  "managedRespawn" : false,
  "crypto" : {
    "principals" : {
      "SecretsManager" : {
        "privateKeyPath" : "file:///greengrass/certs/greengrass-raspberry.private.key"
      },
      "IoTCertificate" : {
        "privateKeyPath" : "file:///greengrass/certs/greengrass-raspberry.private.key",
        "certificatePath" : "file:///greengrass/certs/greengrass-raspberry.cert.pem"
      }
    },
    "caPath" : "file:///greengrass/certs/root.ca.pem"
  }

```
Once this is done you can start Greengrass Core daemon by running the following command:

```
cd /greengrass/ggc/core/
sudo ./greengrassd start
```

You should see a Greengrass successfully started message. Logs are available at the following folder:

```/greengrass/ggc/var/log```

Last step of this process is to deploy this configuration from your AWS Management console to your Greengrass device. Please go to AWS IoT -> Greengrass -> Groups -> Raspberry\_Pi. Click &quot;Actions&quot; in the right top corner and press &quot;Deploy&quot;.

![](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/deployments.png)

# Connecting Amazon FreeRTOS device (STM32 board) to AWS IoT Greengrass

Demo application for this blueprint can be downloaded from [here](https://d268s23yov0ww.cloudfront.net/iot-predictive-maintenance-blueprint/stm32-blueprint-demo-FreeRTOS.zip) and it&#39;s based on FreeRTOS available from AWS console -> AWS IoT -> Software -> FreeRTOS Device Software -> Connect to AWS IoT - STM32-B-L475E-I.

To run this demo you need to modify only two files: _aws\_clientcredential.h_ and _aws\_clientcredential\_keys.h_

Please paste the contents of _stm32-board.cert.pem_ and _stm32-board.private.key_ to _aws\_clientcredential\_keys.h_
```
#define keyCLIENT_CERTIFICATE_PEM \ ...
```
and
```
#define keyCLIENT_PRIVATE_KEY_PEM \ ...
```

Also modify _aws\_clientcredential.h_ with the endpoint from your AWS IoT Core setting tab.

```
static const char clientcredentialMQTT_BROKER_ENDPOINT[] = "YOUR_ENDPOINT.iot.REGION.amazonaws.com";

```

as well as your Wifi credentials and thing name in case it was modified.


To build the demo you can use STM32CubeIDE freely available from [https://www.st.com/en/development-tools/stm32cubeide.html](https://www.st.com/en/development-tools/stm32cubeide.html)

Now you can build and run the demo. Output is available by connecting any serial monitor like PuTTY or RealTerm to the port associated with the STM32 board.

# Testing the blueprint

To check if data ingestion from our edge devices is working, we can simply go to AWS Console -> IoT Core -> Test and subscribe to the following topics:

```
sensors/stm32_board_1/data 
```
// (data from the STM32 board)

```
gpio/Raspberry_Pi_Thing/6/state 
```
// (state of GPIO 6 port on Raspberry Pi Zero W)

You should see data similar to this on stm32 topic:
```
{
   "sensor_id":"NAME_OF_THE_SENSOR",
   "temperature": float[-40 to +120 Celsius],
   "humidity": float [0 - 100%],
   "pressure": float[260 to 1260 hPa],
   "accelerometer_x": 12 bit int,
   "accelerometer_y": 12 bit int,
   "accelerometer_z": 12 bit int,
   "magnetometer_x": 12 bit int,
   "magnetometer_y": 12 bit int,
   "magnetometer_z": 12 bit int,
   "canbus_data":{
      "byte0":byte,
      "byte1":byte,
      "byte2":byte,
      "byte3":byte,
      "byte4":byte,
      "byte5":byte,
      "byte6":byte,
      "byte7":byte
   }
}
```

On the Raspberry Pi GPIO topic data coming in is just _0_ and _1_ depending on the state of the port. It's being polled every 50ms and if any change is detected, it's published to this topic.