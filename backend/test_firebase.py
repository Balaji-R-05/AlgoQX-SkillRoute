import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

def test_firebase():
    print("Testing Firebase initialization...")
    try:
        if not firebase_admin._apps:
            project_id = os.getenv("FIREBASE_PROJECT_ID")
            private_key = os.getenv("FIREBASE_PRIVATE_KEY")
            client_email = os.getenv("FIREBASE_CLIENT_EMAIL")

            if project_id and private_key and client_email:
                print(f"Using individual env vars for project: {project_id}")
                private_key = private_key.replace("\\n", "\n")
                cert = {
                    "type": "service_account",
                    "project_id": project_id,
                    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID", ""),
                    "private_key": private_key,
                    "client_email": client_email,
                    "client_id": os.getenv("FIREBASE_CLIENT_ID", ""),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email.replace('@', '%40')}",
                    "universe_domain": "googleapis.com"
                }
                cred = credentials.Certificate(cert)
            else:
                key_path = os.getenv("FIREBASE_KEY_PATH", "firebase_key.json")
                print(f"Falling back to JSON file: {key_path}")
                if not os.path.exists(key_path):
                    print(f"ERROR: {key_path} not found!")
                    return
                cred = credentials.Certificate(key_path)

            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print("Firebase initialized successfully!")
    except Exception as e:
        print(f"ERROR during Firebase initialization: {str(e)}")

if __name__ == "__main__":
    test_firebase()
