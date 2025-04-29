import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List, Dict, Tuple
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize

# Download required NLTK data
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('averaged_perceptron_tagger')

class TFIDFAnalyzer:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2),
            use_idf=True,
            smooth_idf=True
        )
        self.feature_names = []
        self.tfidf_matrix = None
        self.documents = []

    def preprocess_text(self, text: str) -> str:
        """
        Comprehensive text preprocessing
        """
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters and digits
        text = re.sub(r'[^a-zA-Z\s]', '', text)
        
        # Tokenize
        tokens = word_tokenize(text)
        
        # Remove stopwords
        stop_words = set(stopwords.words('english'))
        tokens = [token for token in tokens if token not in stop_words]
        
        # Join tokens back into text
        return ' '.join(tokens)

    def fit_transform(self, documents: List[str]) -> np.ndarray:
        """
        Fit TF-IDF vectorizer and transform documents
        """
        # Preprocess documents
        self.documents = [self.preprocess_text(doc) for doc in documents]
        
        # Fit and transform
        self.tfidf_matrix = self.vectorizer.fit_transform(self.documents)
        self.feature_names = self.vectorizer.get_feature_names_out()
        
        return self.tfidf_matrix

    def get_top_terms(self, n: int = 10) -> List[List[Tuple[str, float]]]:
        """
        Get top N terms for each document
        """
        top_terms = []
        for doc_idx in range(self.tfidf_matrix.shape[0]):
            # Get scores for current document
            scores = self.tfidf_matrix[doc_idx].toarray()[0]
            
            # Get indices of top N scores
            top_indices = np.argsort(scores)[-n:][::-1]
            
            # Get terms and scores
            doc_terms = [(self.feature_names[idx], scores[idx]) for idx in top_indices]
            top_terms.append(doc_terms)
            
        return top_terms

    def get_document_similarity(self, doc1_idx: int, doc2_idx: int) -> float:
        """
        Calculate cosine similarity between two documents
        """
        vec1 = self.tfidf_matrix[doc1_idx].toarray()[0]
        vec2 = self.tfidf_matrix[doc2_idx].toarray()[0]
        
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

    def extract_key_sentences(self, document: str, n: int = 3) -> List[str]:
        """
        Extract key sentences based on TF-IDF scores
        """
        # Tokenize into sentences
        sentences = sent_tokenize(document)
        
        # Calculate TF-IDF for each sentence
        sentence_scores = []
        sentence_tfidf = self.vectorizer.transform(sentences)
        
        for idx, sentence in enumerate(sentences):
            score = np.sum(sentence_tfidf[idx].toarray())
            sentence_scores.append((sentence, score))
        
        # Sort by score and get top N sentences
        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        return [sentence for sentence, score in sentence_scores[:n]]

    def analyze_document(self, document: str) -> Dict:
        """
        Comprehensive document analysis using TF-IDF
        """
        # Preprocess document
        processed_doc = self.preprocess_text(document)
        
        # Transform single document
        doc_tfidf = self.vectorizer.transform([processed_doc])
        
        # Get top terms
        scores = doc_tfidf.toarray()[0]
        top_indices = np.argsort(scores)[-10:][::-1]
        top_terms = [(self.feature_names[idx], scores[idx]) for idx in top_indices]
        
        # Extract key sentences
        key_sentences = self.extract_key_sentences(document)
        
        # Get document statistics
        word_count = len(word_tokenize(document))
        sentence_count = len(sent_tokenize(document))
        
        return {
            'top_terms': top_terms,
            'key_sentences': key_sentences,
            'statistics': {
                'word_count': word_count,
                'sentence_count': sentence_count,
                'average_sentence_length': word_count / sentence_count if sentence_count > 0 else 0
            }
        }

# Example usage
if __name__ == "__main__":
    # Sample documents
    docs = [
        "Natural language processing (NLP) is a field of artificial intelligence.",
        "Machine learning algorithms can process and analyze text data.",
        "TF-IDF helps in finding important terms in documents."
    ]
    
    # Initialize analyzer
    analyzer = TFIDFAnalyzer()
    
    # Fit and transform documents
    tfidf_matrix = analyzer.fit_transform(docs)
    
    # Get top terms for each document
    top_terms = analyzer.get_top_terms()
    
    # Print results
    for idx, terms in enumerate(top_terms):
        print(f"\nTop terms in document {idx + 1}:")
        for term, score in terms:
            print(f"{term}: {score:.4f}") 