#!/usr/bin/env python3
import sys
import json
import os
import torch
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSeq2SeqGeneration, pipeline

# Get the absolute path to the model cache directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CACHE_DIR = os.path.join(SCRIPT_DIR, '../../model_cache')
MODEL_CACHE_DIR = os.getenv('MODEL_CACHE_DIR', DEFAULT_CACHE_DIR)

def ensure_cache_dir():
    """Ensure the model cache directory exists."""
    try:
        cache_dir = Path(MODEL_CACHE_DIR).resolve()
        cache_dir.mkdir(parents=True, exist_ok=True)
        print(f"Using cache directory: {cache_dir}", file=sys.stderr)
        return str(cache_dir)
    except Exception as e:
        print(f"Error creating cache directory: {str(e)}", file=sys.stderr)
        # Fallback to a temporary directory
        import tempfile
        tmp_dir = tempfile.mkdtemp(prefix='model_cache_')
        print(f"Using temporary cache directory: {tmp_dir}", file=sys.stderr)
        return tmp_dir

def load_model(model_name):
    """Load model and tokenizer with caching."""
    try:
        cache_dir = ensure_cache_dir()
        print(f"Loading model {model_name} from cache directory: {cache_dir}", file=sys.stderr)
        
        # Load tokenizer and model with caching
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=cache_dir,
            local_files_only=False  # Allow downloading if not in cache
        )
        model = AutoModelForSeq2SeqGeneration.from_pretrained(
            model_name,
            cache_dir=cache_dir,
            local_files_only=False  # Allow downloading if not in cache
        )
        
        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}", file=sys.stderr)
        model = model.to(device)
        
        return model, tokenizer
    except Exception as e:
        print(f"Error loading model: {str(e)}", file=sys.stderr)
        raise

def chunk_text(text, max_length=1024):
    """Split text into chunks that fit within model's maximum length."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        if current_length + len(word) + 1 > max_length:
            chunks.append(' '.join(current_chunk))
            current_chunk = [word]
            current_length = len(word)
        else:
            current_chunk.append(word)
            current_length += len(word) + 1
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def generate_summary(text, model_name, params):
    """Generate summary using local model with chunking support."""
    try:
        # Load model and tokenizer
        model, tokenizer = load_model(model_name)
        
        # Create summarization pipeline
        summarizer = pipeline(
            "summarization",
            model=model,
            tokenizer=tokenizer,
            device=0 if torch.cuda.is_available() else -1
        )
        
        # Get max input length for model
        max_length = min(
            tokenizer.model_max_length,
            params.get('max_length', 1024)
        )
        
        # Chunk text if needed
        chunks = chunk_text(text, max_length) if len(text) > max_length else [text]
        
        # Generate summaries for chunks
        summaries = []
        for chunk in chunks:
            summary = summarizer(
                chunk,
                max_length=params.get('max_length', 1024),
                min_length=params.get('min_length', 150),
                do_sample=params.get('do_sample', True),
                temperature=params.get('temperature', 0.7),
                num_beams=params.get('num_beams', 4),
                length_penalty=params.get('length_penalty', 2.0),
                repetition_penalty=params.get('repetition_penalty', 1.5),
                top_p=params.get('top_p', 0.95),
                no_repeat_ngram_size=params.get('no_repeat_ngram_size', 3),
            )
            summaries.append(summary[0]['summary_text'])
        
        # Combine summaries if multiple chunks
        final_summary = ' '.join(summaries)
        
        # If combined summary is too long, summarize again
        if len(final_summary.split()) > params.get('max_length', 1024):
            final_summary = summarizer(
                final_summary,
                max_length=params.get('max_length', 1024),
                min_length=params.get('min_length', 150),
                do_sample=params.get('do_sample', True),
                temperature=params.get('temperature', 0.7),
                num_beams=params.get('num_beams', 4),
            )[0]['summary_text']
        
        return final_summary
        
    except Exception as e:
        print(f"Error in generate_summary: {str(e)}", file=sys.stderr)
        return json.dumps({"error": str(e)})

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({
            "error": "Invalid arguments. Expected: input_file model_name params"
        }))
        sys.exit(1)
        
    input_file = sys.argv[1]
    model_name = sys.argv[2]
    params = json.loads(sys.argv[3])
    
    try:
        # Read input text
        with open(input_file, 'r', encoding='utf-8') as f:
            text = f.read()
        
        # Generate summary
        summary = generate_summary(text, model_name, params)
        
        # Return result
        print(json.dumps({"summary": summary}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1) 