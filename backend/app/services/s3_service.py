import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

class S3Service:
    def __init__(self):
        self.bucket_name = os.getenv('AWS_STORAGE_BUCKET_NAME')
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_S3_REGION_NAME', 'ap-southeast-1')
        )

    async def upload_file(self, file_content: bytes, file_name: str, content_type: str = 'application/pdf') -> str:
        """
        Uploads a file to S3 and returns the public/authorized URL.
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=file_name,
                Body=file_content,
                ContentType=content_type
            )
            
            # Since the bucket is likely private, we'll return the key (which we'll use to generate presigned URLs if needed)
            # or the standard S3 URL if the bucket is public. 
            # For now, let's assume we want to store the URL.
            url = f"https://{self.bucket_name}.s3.{os.getenv('AWS_S3_REGION_NAME', 'ap-southeast-1')}.amazonaws.com/{file_name}"
            return url
            
        except ClientError as e:
            print(f"Error uploading to S3: {e}")
            raise e

    def generate_presigned_url(self, file_name: str, expiration=3600) -> str:
        """
        Generates a presigned URL to share an S3 object.
        """
        try:
            response = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': file_name},
                ExpiresIn=expiration
            )
        except ClientError as e:
            print(f"Error generating presigned URL: {e}")
            return None

        return response

    def list_all_files(self, prefix: str = "") -> list:
        """
        Lists all files in the bucket with an optional prefix.
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name, 
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                return []
                
            return [obj['Key'] for obj in response['Contents']]
            
        except ClientError as e:
            print(f"Error listing S3 objects: {e}")
            return []

s3_service = S3Service()
