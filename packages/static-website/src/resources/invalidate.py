import logging as log
import cfnresponse as cf
import boto3
import uuid
import mimetypes
from botocore.client import Config
import json
import zipfile, os, tempfile, sys, time
import subprocess


def main(ev, context):
    log.getLogger().setLevel(log.INFO)
    try:
        log.info(f'Invalidate - input: {ev}')

        logical_id = ev['LogicalResourceId']
        request_type = ev['RequestType']
        stack_id = ev['StackId']
        props = ev['ResourceProperties']

        resp = {}
        if request_type == "Delete":
            cf.send(ev, context, cf.SUCCESS, resp, str(uuid.uuid4()))
            return

        client = boto3.client('cloudfront')
        do_invalidate(props, client)
        cf.send(ev, context, cf.SUCCESS, resp, str(uuid.uuid4()))
    except Exception as e:
        log.exception(e)
        cf.send(ev, context, cf.FAILED, {}, str(uuid.uuid4()))

def do_invalidate(props, client):
    print("Invalidating CloudFront cache")

    invalidation_paths = props.get('InvalidationPaths', props.get('ObjectPath', '/*').split(','))
    distribution_id = props['DistributionId']

    client.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            'Paths': {
                'Quantity': len(invalidation_paths),
                'Items': invalidation_paths
            },
            'CallerReference': str(time.time())
        }
    )
