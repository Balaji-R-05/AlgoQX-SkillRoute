import os
import httpx
import logging
from telegram import Update
from telegram.ext import ApplicationBuilder, MessageHandler, filters, ContextTypes, CommandHandler
from app.services.bot_service import handle_incoming_pdf

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO
)

async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a message when the command /start is issued."""
    await update.message.reply_text('Hello! Send me a PDF and I will index it into your resource hub. 📚')

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle incoming PDF documents."""
    doc = update.message.document
    
    if doc.mime_type != "application/pdf":
        await update.message.reply_text("Please send a valid PDF file. ❌")
        return

    await update.message.reply_text("⏳ Received! Working on extracting and saving your PDF...")
    
    file_info = await context.bot.get_file(doc.file_id)
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(file_info.file_path)
        pdf_bytes = resp.content

    phone_or_id = str(update.effective_user.id)
    
    # Process it via the bot service: uploads to S3, chunks docs, uses Ollama, and stores to Neon Postgres
    result = await handle_incoming_pdf(phone_or_id, pdf_bytes, doc.file_name)
    
    await update.message.reply_text(result)

def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        logging.error("TELEGRAM_BOT_TOKEN is not set in the environment.")
        return
        
    app = ApplicationBuilder().token(token).build()

    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(MessageHandler(filters.Document.PDF, handle_document))
    
    logging.info("Bot is polling...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
