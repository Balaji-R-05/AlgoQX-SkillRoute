import logging
import yaml
import os
import tempfile
from pathlib import Path
from telegram import Update, Message, Document, PhotoSize
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters
from s3_utils import upload_file_to_s3
from embed_utils import get_embedding
from db_utils import insert_record

CONFIG_PATH = Path(__file__).parent / "config.yaml"
with open(CONFIG_PATH, "r") as f:
    config = yaml.safe_load(f)

TELEGRAM_TOKEN = config.get("telegram_bot_token", "YOUR_TELEGRAM_BOT_TOKEN")
MAX_FILE_SIZE_MB = config.get("file", {}).get("max_size_mb", 10)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming documents (any file type)."""
    message: Message = update.effective_message
    doc: Document = message.document
    if not doc:
        return

    # Size check (Telegram provides file size in bytes)
    if doc.file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        await message.reply_text(f"File is too large. Max size is {MAX_FILE_SIZE_MB} MB.")
        return

    # Download to temporary file
    with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
        telegram_file = await doc.get_file()
        await telegram_file.download_to_drive(custom_path=tmp_file.name)
        local_path = tmp_file.name

    # Create a unique S3 key (you can customise this)
    s3_key = f"uploads/{doc.file_name}"  # placeholder – you may want to add user ID / timestamp

    # Upload to S3
    try:
        upload_file_to_s3(local_path, s3_key)
    except Exception as e:
        logger.exception("S3 upload failed")
        await message.reply_text("Failed to upload file to storage.")
        os.remove(local_path)
        return

    # Read file content for embedding – for simplicity we read as bytes and decode if possible
    try:
        with open(local_path, "rb") as f:
            content_bytes = f.read()
        # Attempt to decode as UTF‑8 text; fallback to raw bytes representation
        try:
            content_text = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content_text = str(content_bytes)
        embedding = get_embedding(content_text)
    except Exception as e:
        logger.exception("Embedding generation failed")
        await message.reply_text("Failed to generate embedding.")
        os.remove(local_path)
        return

    # Store metadata + embedding in Postgres
    try:
        insert_record(
            s3_key=s3_key,
            filename=doc.file_name,
            user_id=message.from_user.id,
            embedding=embedding,
            metadata={"file_size": doc.file_size},
        )
    except Exception as e:
        logger.exception("DB insert failed")
        await message.reply_text("Failed to store embedding in database.")
        os.remove(local_path)
        return

    # Clean up temporary file
    os.remove(local_path)

    await message.reply_text("File uploaded and processed successfully!")

# Photo handling – Telegram sends photos as a list of sizes, we pick the biggest
async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message: Message = update.effective_message
    photos: list[PhotoSize] = message.photo
    if not photos:
        return
    # Choose the highest resolution version
    photo = photos[-1]
    if photo.file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
        await message.reply_text(f"Photo is too large. Max size is {MAX_FILE_SIZE_MB} MB.")
        return
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        telegram_file = await photo.get_file()
        await telegram_file.download_to_drive(custom_path=tmp_file.name)
        local_path = tmp_file.name
    s3_key = f"uploads/{Path(local_path).name}"
    try:
        upload_file_to_s3(local_path, s3_key)
        with open(local_path, "rb") as f:
            content_bytes = f.read()
        embedding = get_embedding(content_bytes.decode("utf-8", errors="ignore"))
        insert_record(
            s3_key=s3_key,
            filename="photo.jpg",
            user_id=message.from_user.id,
            embedding=embedding,
            metadata={"file_size": photo.file_size},
        )
        await message.reply_text("Photo uploaded and processed successfully!")
    except Exception as e:
        logger.exception("Error processing photo")
        await message.reply_text("Failed to process photo.")
    finally:
        os.remove(local_path)

def main() -> None:
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()

    # Register handlers for documents and photos
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    logger.info("Bot started. Listening for files...")
    app.run_polling()

if __name__ == "__main__":
    main()
