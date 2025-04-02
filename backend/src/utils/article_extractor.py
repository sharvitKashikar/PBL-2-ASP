import sys
import json
from newspaper import Article
from urllib.parse import urlparse
import requests
from newspaper import Config
import time

def get_website_name(url):
    parsed_url = urlparse(url)
    domain = parsed_url.netloc
    if domain.startswith("www."):
        domain = domain[4:]
    return domain

def extract_article(url):
    try:
        # Configure newspaper with custom user agent and settings
        config = Config()
        config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        config.request_timeout = 15
        config.memoize_articles = False
        config.fetch_images = False
        
        # First try to get the page with requests to check accessibility
        headers = {
            'User-Agent': config.browser_user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
        except requests.exceptions.RequestException as e:
            if '403' in str(e):
                return {
                    "success": False,
                    "error": "Access denied. This website might be blocking automated access. Please try a different article or website."
                }
            elif '401' in str(e):
                return {
                    "success": False,
                    "error": "Authentication required. This website requires login or has restricted access."
                }
            elif '404' in str(e):
                return {
                    "success": False,
                    "error": "Article not found. The URL might be incorrect or the article might have been removed."
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to access URL: {str(e)}"
                }
        
        # If successful, proceed with newspaper
        article = Article(url, config=config)
        
        # Add a small delay to avoid rate limiting
        time.sleep(1)
        
        article.download()
        article.parse()
        article.nlp()

        title = article.title
        authors = ', '.join(article.authors)
        if not authors:
            authors = get_website_name(url)
        publish_date = article.publish_date.strftime('%B %d, %Y') if article.publish_date else "N/A"
        top_image = article.top_image

        # Get the full text for summarization
        article_text = article.text

        if not article_text:
            return {
                "success": False,
                "error": "No text content could be extracted from the article. The website might be using a different format or structure."
            }

        return {
            "success": True,
            "title": title,
            "authors": authors,
            "publish_date": publish_date,
            "text": article_text,
            "top_image": top_image
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error processing article: {str(e)}"
        }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "URL argument required"}))
        sys.exit(1)

    url = sys.argv[1]
    result = extract_article(url)
    print(json.dumps(result)) 