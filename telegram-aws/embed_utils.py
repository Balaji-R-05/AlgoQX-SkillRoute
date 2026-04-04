from sentence_transformers import SentenceTransformer
import logging
from pathlib import Path
import yaml

logger = logging.getLogger(__name__)

# Load config
CONFIG_PATH = Path(__file__).parent / "config.yaml"
if CONFIG_PATH.exists():
    with open(CONFIG_PATH, "r") as f:
        config = yaml.safe_load(f)
        model_name = config.get("embedding", {}).get("model_name", "sentence-transformers/all-MiniLM-L6-v2")
else:
    model_name = "sentence-transformers/all-MiniLM-L6-v2"

logger.info(f"Loading embedding model: {model_name}")
# Load model once at startup
try:
    model = SentenceTransformer(model_name)
except Exception as e:
    logger.exception("Failed to load SentenceTransformer model")
    raise

def get_embedding(text: str) -> list[float]:
    """Generate a vector embedding for the given text.

    Args:
        text: The text string to embed.

    Returns:
        A list of floats representing the embedding vector.
    """
    try:
        # Generate embedding as a tensor, then convert to a list of floats
        embedding = model.encode(text)
        return embedding.tolist()
    except Exception as e:
        logger.exception("Failed to generate embedding")
        raise
