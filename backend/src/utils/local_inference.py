#!/usr/bin/env python3
import sys
import json
import os
import torch
import logging
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Get the absolute path to the model cache directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CACHE_DIR = os.path.join(SCRIPT_DIR, '../../model_cache')
MODEL_CACHE_DIR = os.getenv('MODEL_CACHE_DIR', DEFAULT_CACHE_DIR)

CONTENT_TYPE_CONFIGS = {
    "article": {
        "max_length": 200,
        "min_length": 100,
        "length_penalty": 2.0,
        "num_beams": 6,
        "temperature": 0.7,
        "repetition_penalty": 1.2
    },
    "technical": {
        "max_length": 250,
        "min_length": 120,
        "length_penalty": 1.8,
        "num_beams": 8,
        "temperature": 0.6,
        "repetition_penalty": 1.3
    },
    "research": {
        "max_length": 180,
        "min_length": 90,
        "length_penalty": 1.5,
        "num_beams": 5,
        "temperature": 0.8,
        "repetition_penalty": 1.1
    }
}

def ensure_cache_dir():
    """Ensure the model cache directory exists."""
    try:
        cache_dir = Path(MODEL_CACHE_DIR).resolve()
        os.makedirs(str(cache_dir), mode=0o755, exist_ok=True)
        logger.info(f"Using cache directory: {cache_dir}")
        
        # Test write permissions
        test_file = cache_dir / '.write_test'
        try:
            test_file.touch()
            test_file.unlink()
        except Exception as e:
            logger.warning(f"Cache directory is not writable: {e}")
            # Fallback to system temp directory
            import tempfile
            cache_dir = Path(tempfile.gettempdir()) / 'model_cache'
            os.makedirs(str(cache_dir), mode=0o755, exist_ok=True)
            logger.info(f"Falling back to temporary cache directory: {cache_dir}")
        
        return str(cache_dir)
    except Exception as e:
        logger.error(f"Error creating cache directory: {str(e)}")
        # Fallback to a temporary directory
        import tempfile
        tmp_dir = tempfile.mkdtemp(prefix='model_cache_')
        logger.info(f"Using temporary cache directory: {tmp_dir}")
        return tmp_dir

def detect_content_type(text):
    """Detect the type of content based on text characteristics."""
    technical_keywords = {'algorithm', 'model', 'implementation', 'architecture', 'system', 'framework'}
    research_keywords = {'study', 'research', 'findings', 'results', 'analysis', 'experiment'}
    
    words = set(text.lower().split())
    technical_score = len(words.intersection(technical_keywords))
    research_score = len(words.intersection(research_keywords))
    
    if technical_score > research_score:
        return "technical"
    elif research_score > technical_score:
        return "research"
    return "article"

def load_model(model_name):
    """Load model and tokenizer from HuggingFace Hub or cache."""
    cache_dir = os.path.join(os.path.dirname(__file__), "model_cache")
    os.makedirs(cache_dir, exist_ok=True)
    logger.info(f"Using cache directory: {cache_dir}")
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir=cache_dir)
        logger.info("Successfully loaded model and tokenizer")
        return model, tokenizer
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        raise

def chunk_text(text, max_length=1024):
    """Split text into chunks that fit within max_length tokens."""
    # Simple sentence-based chunking
    sentences = text.split('. ')
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        # Rough estimate of token length (words + punctuation)
        sentence_length = len(sentence.split()) + 2
        
        if current_length + sentence_length > max_length:
            # Save current chunk and start new one
            if current_chunk:
                chunks.append('. '.join(current_chunk) + '.')
            current_chunk = [sentence]
            current_length = sentence_length
        else:
            current_chunk.append(sentence)
            current_length += sentence_length
    
    # Add final chunk
    if current_chunk:
        chunks.append('. '.join(current_chunk) + '.')
    
    return chunks if chunks else [text]

def generate_summary(text, model, tokenizer, params):
    """Generate summary using the loaded model with specified parameters."""
    import torch
    
    # Set device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)
    
    # Validate and process parameters
    max_length = int(params.get('max_length', 300))
    min_length = int(params.get('min_length', 100))
    temperature = float(params.get('temperature', 0.3))
    num_beams = int(params.get('num_beams', 4))
    no_repeat_ngram_size = int(params.get('no_repeat_ngram_size', 3))
    length_penalty = float(params.get('length_penalty', 2.0))
    early_stopping = bool(params.get('early_stopping', True))
    
    # Chunk text if needed
    chunks = chunk_text(text, max_length=1024)  # Tokenizer max length
    summaries = []
    
    try:
        for chunk in chunks:
            # Tokenize input
            inputs = tokenizer(chunk, return_tensors="pt", truncation=True, max_length=1024)
            inputs = inputs.to(device)
            
            # Generate summary
            with torch.no_grad():
                output_ids = model.generate(
                    inputs["input_ids"],
                    max_length=max_length,
                    min_length=min_length,
                    num_beams=num_beams,
                    temperature=temperature,
                    do_sample=temperature > 0,
                    no_repeat_ngram_size=no_repeat_ngram_size,
                    length_penalty=length_penalty,
                    early_stopping=early_stopping
                )
            
            # Decode summary
            summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
            summaries.append(summary)
        
        # Combine summaries if multiple chunks
        final_summary = " ".join(summaries)
        logger.info("Summary generated successfully")
        return final_summary
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise Exception(f"Failed to generate summary: {str(e)}")

def run_inference(input_file, model_name, params_json):
    """Run inference using the specified model and parameters."""
    try:
        # Load input text
        with open(input_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        
        if not text:
            logger.error("Empty text provided")
            return json.dumps({"error": "Empty text provided for summarization"})
        
        logger.info(f"Input text length: {len(text)} characters")
        
        # Load model and tokenizer
        try:
            model, tokenizer = load_model(model_name)
            logger.info("Model and tokenizer loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load model: {str(e)}")
            return json.dumps({"error": f"Failed to load model: {str(e)}"})
        
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {device}")
        model = model.to(device)
        
        # Parse parameters
        try:
            params = json.loads(params_json)
            logger.info(f"Using parameters: {params}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid parameters JSON: {str(e)}")
            params = {}
        
        # Detect content type and get appropriate config
        content_type = detect_content_type(text)
        base_config = CONTENT_TYPE_CONFIGS.get(content_type, CONTENT_TYPE_CONFIGS["article"])
        config = {**base_config, **params}
        logger.info(f"Using content type: {content_type} with config: {config}")
        
        # Generate summary
        try:
            summary = generate_summary(text, model, tokenizer, config)
            if not summary:
                logger.error("Generated summary is empty")
                return json.dumps({"error": "Failed to generate summary: empty result"})
            
            logger.info("Summary generated successfully")
            return json.dumps({"summary": summary})
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            return json.dumps({"error": f"Failed to generate summary: {str(e)}"})
        
    except Exception as e:
        logger.error(f"Error during inference: {str(e)}")
        return json.dumps({"error": f"Error during inference: {str(e)}"})

def main():
    """Main function to handle command line arguments and generate summary."""
    import json
    import sys
    
    if len(sys.argv) != 4:
        result = {
            "success": False,
            "error": "Invalid arguments. Expected: input_file model_name params_json"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    try:
        input_file = sys.argv[1]
        model_name = sys.argv[2]
        params = json.loads(sys.argv[3])
        
        # Read input text
        with open(input_file, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # Log input details
        logger.info(f"Model: {model_name}")
        logger.info(f"Input file: {input_file}")
        logger.info(f"Parameters: {params}")
        logger.info(f"Input text length: {len(text)} characters")
        
        # Load model and generate summary
        result = run_inference(input_file, model_name, json.dumps(params))
        print(result)
        
    except Exception as e:
        result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main() 