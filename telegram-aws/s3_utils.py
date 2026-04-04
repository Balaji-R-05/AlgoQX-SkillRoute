import boto3
import os
import logging
from pathlib import Path
import yaml

# Load AWS config from config.yaml (placeholder values)
CONFIG_PATH = Path(__file__).parent / "config.yaml"
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
        aws_cfg = config.get("aws", {})
else:
    aws_cfg = {}

AWS_ACCESS_KEY_ID = aws_cfg.get("access_key_id", "YOUR_AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = aws_cfg.get("secret_access_key", "YOUR_AWS_SECRET_ACCESS_KEY")
AWS_REGION = aws_cfg.get("region", "YOUR_AWS_REGION")
S3_BUCKET = aws_cfg.get("bucket_name", "YOUR_S3_BUCKET_NAME")

# Initialize boto3 client
_s3_client = boto3.client(
    "s3",
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_REGION,
)

logger = logging.getLogger(__name__)

def upload_file_to_s3(local_path: str, s3_key: str) -> None:
    """Upload a local file to the configured S3 bucket.

    Args:
        local_path: Path to the local file.
        s3_key: Destination key (path) inside the bucket.
    """
    if not os.path.isfile(local_path):
        raise FileNotFoundError(f"File not found: {local_path}")
    try:
        _s3_client.upload_file(local_path, S3_BUCKET, s3_key)
        logger.info("Uploaded %s to s3://%s/%s", local_path, S3_BUCKET, s3_key)
    except Exception as e:
        logger.exception("Failed to upload %s to S3", local_path)
        raise
