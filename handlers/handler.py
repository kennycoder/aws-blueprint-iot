import time
import os
import greengrasssdk
import json

iot_client = greengrasssdk.client('iot-data')

INPUT_GPIOS = [6]
thingName = os.environ['AWS_IOT_THING_NAME']

def get_read_topic(gpio_num):
    return '/'.join(['gpio', thingName, str(gpio_num), 'read'])

def send_message_to_connector(topic, message=''):
    iot_client.publish(topic=topic, payload=str(message))

def read_gpio_state(gpio):
    send_message_to_connector(get_read_topic(gpio))

def publish_basic_message():
    print('Reading GPIOs')
    for i in INPUT_GPIOS:
    	read_gpio_state(i)

publish_basic_message()

def lambda_handler(event, context):
    return

