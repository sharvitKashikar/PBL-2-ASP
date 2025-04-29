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
MODEL_CACHE_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '../../model_cache'))

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
        os.makedirs(MODEL_CACHE_DIR, mode=0o755, exist_ok=True)
        logger.info(f"Using cache directory: {MODEL_CACHE_DIR}")
        return MODEL_CACHE_DIR
    except Exception as e:
        logger.error(f"Error creating cache directory: {str(e)}")
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
    cache_dir = ensure_cache_dir()
    logger.info(f"Loading model {model_name} from cache directory: {cache_dir}")
    
    try:
        # Always use BART-CNN for consistency
        model_name = 'facebook/bart-large-cnn'
            
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
    try:
        # Input validation
        if len(text.strip()) < 10:
            raise ValueError("Input text is too short")
            
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        model = model.to(device)
        
        # Calculate dynamic length constraints based on input length
        input_length = len(text.split())
        max_length = min(params.get('max_length', 150), input_length // 2)  # Summary can be up to half of input
        min_length = max(params.get('min_length', 75), input_length // 4)   # At least quarter of input
        
        # Ensure max_length is always greater than min_length
        if max_length <= min_length:
            max_length = min_length + 25
            
        # Tokenize with truncation
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=1024)
        inputs = inputs.to(device)
        
        # Generate summary with comprehensive parameters
        with torch.no_grad():
            output_ids = model.generate(
                inputs["input_ids"],
                max_length=max_length,
                min_length=min_length,
                num_beams=params.get('num_beams', 8),
                temperature=params.get('temperature', 0.7),
                do_sample=True,
                early_stopping=True,
                no_repeat_ngram_size=3,
                length_penalty=params.get('length_penalty', 2.0),
                repetition_penalty=params.get('repetition_penalty', 1.5),
                top_p=params.get('top_p', 0.92),
                top_k=params.get('top_k', 50)
            )
        
        summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        
        # If summary is too similar to input or too short, try with more aggressive parameters
        if len(summary.split()) < min_length or summary.lower() == text.lower():
            logger.info("First attempt produced insufficient summary, trying with adjusted parameters")
            output_ids = model.generate(
                inputs["input_ids"],
                max_length=max_length,
                min_length=min_length,
                num_beams=10,
                temperature=0.8,
                do_sample=True,
                early_stopping=True,
                no_repeat_ngram_size=3,
                length_penalty=2.5,
                repetition_penalty=1.8,
                top_p=0.95,
                top_k=40
            )
            summary = tokenizer.decode(output_ids[0], skip_special_tokens=True)
        
        logger.info(f"Generated summary length: {len(summary.split())}")
        return summary
        
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        raise Exception(f"Failed to generate summary: {str(e)}")

def run_inference(input_file, model_name, params_json):
    """Run inference using the specified model and parameters."""
    try:
        # Handle paths with spaces
        input_file = os.path.abspath(os.path.expanduser(input_file))
        logger.info(f"Reading input from: {input_file}")
        
        # Load input text
        with open(input_file, 'r', encoding='utf-8') as f:
            text = f.read().strip()
        
        if not text:
            return json.dumps({"error": "Empty text provided for summarization"})
            
        # Parse parameters
        try:
            params = json.loads(params_json)
        except json.JSONDecodeError as e:
            return json.dumps({"error": f"Invalid parameters format: {str(e)}"})
            
        # Load model and tokenizer
        try:
            model, tokenizer = load_model(model_name)
        except Exception as e:
            return json.dumps({"error": f"Model loading failed: {str(e)}"})
            
        # Generate summary
        try:
            summary = generate_summary(text, model, tokenizer, params)
            return json.dumps({"summary": summary})
        except Exception as e:
            return json.dumps({"error": f"Summary generation failed: {str(e)}"})
            
    except Exception as e:
        return json.dumps({"error": str(e)})

def main():
    """Main entry point."""
    if len(sys.argv) != 4:
        print(json.dumps({
            "error": "Invalid arguments. Usage: script.py <input_file> <model_name> <params_json>"
        }))
        sys.exit(1)
        
    input_file = sys.argv[1]
    model_name = sys.argv[2]
    params_json = sys.argv[3]
    
    print(run_inference(input_file, model_name, params_json))

if __name__ == "__main__":
    main() 