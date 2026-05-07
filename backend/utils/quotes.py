import requests
import random

FALLBACK_QUOTES = [
    {"text": "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", "author": "Dr. Seuss"},
    {"text": "The expert in anything was once a beginner.", "author": "Helen Hayes"},
    {"text": "Learning never exhausts the mind.", "author": "Leonardo da Vinci"},
    {"text": "Live as if you were to die tomorrow. Learn as if you were to live forever.", "author": "Mahatma Gandhi"},
    {"text": "Knowledge is power.", "author": "Francis Bacon"},
    {"text": "The beautiful thing about learning is that no one can take it away from you.", "author": "B.B. King"},
    {"text": "Education is the most powerful weapon which you can use to change the world.", "author": "Nelson Mandela"},
    {"text": "The mind is not a vessel to be filled, but a fire to be kindled.", "author": "Plutarch"}
]

def get_daily_quote():
    """
    Fetches a random inspirational quote from an external API with a local fallback.
    """
    try:
        # Fetch from QuotesDB API
        resp = requests.get("https://quotes-db.vercel.app/api/random", timeout=2)
        if resp.status_code == 200:
            quote_data = resp.json()
            return {"text": quote_data["quote"], "author": quote_data["author"]}
    except Exception:
        pass
    
    # Fallback to local list
    return random.choice(FALLBACK_QUOTES)
