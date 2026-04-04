import os
import argparse
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from dotenv import load_dotenv

# Load variables from .env file.
# Note: since OpenClaw runs this script, we need to make sure we look for the .env
# in the same directory as this script.
script_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(script_dir, '.env')
load_dotenv(dotenv_path)

def upload_to_s3(file_path, object_name=None):
    """
    Upload a file to an S3 bucket using credentials from .env

    :param file_path: File to upload
    :param object_name: S3 object name. If not specified then file_name is used
    :return: True if file was uploaded, else False
    """
    bucket_name = os.getenv("S3_BUCKET_NAME")
    if not bucket_name or bucket_name == "your_bucket_name_here":
        print("Error: S3_BUCKET_NAME is not properly set in the .env file")
        return False

    # If S3 object_name was not specified, use file_name
    if object_name is None:
        object_name = os.path.basename(file_path)

    endpoint_url = os.getenv("S3_ENDPOINT_URL")
    region_name = os.getenv("S3_REGION_NAME")

    # Prepare client kwargs dynamically based on available .env vars
    s3_kwargs = {}
    if endpoint_url:
        s3_kwargs['endpoint_url'] = endpoint_url
    if region_name:
        s3_kwargs['region_name'] = region_name

    # Initialize the S3 client.
    # Boto3 automatically uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY if they are in the environment
    s3_client = boto3.client('s3', **s3_kwargs)

    try:
        print(f"Uploading '{file_path}' to s3://{bucket_name}/{object_name} ...")
        s3_client.upload_file(file_path, bucket_name, object_name)
        print("Upload Successful")
        return True
    except FileNotFoundError:
        print(f"Error: The file {file_path} was not found")
        return False
    except NoCredentialsError:
        print("Error: Credentials not available. Please make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are in your .env file.")
        return False
    except ClientError as e:
        print(f"Failed to upload: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload a file to S3")
    parser.add_argument("--file", "-f", required=True, help="The path to the local file to upload")
    parser.add_argument("--name", "-n", required=False, help="The S3 object name (defaults to file name)")
    args = parser.parse_args()

    upload_to_s3(args.file, args.name)
