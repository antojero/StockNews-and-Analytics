from django.http import JsonResponse
import feedparser
import requests
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
from .models import Stock
import yfinance as yf

from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime

# Helper function to fetch news (not a view)
def fetch_news_data(stock):
    all_news = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    # q={stock}+stock+news+india+when:7d -> filters for last 7 days at source
    rss_url = f"https://news.google.com/rss/search?q={stock}+stock+news+india+when:7d&hl=en-IN&gl=IN&ceid=IN:en"
    
    try:
        response = requests.get(rss_url, headers=headers)
        feed = feedparser.parse(response.content)
        
        # Calculate limit date (7 days ago)
        limit_date = datetime.now().astimezone() - timedelta(days=7)

        for entry in feed.entries: 
            try:
                published_dt = parsedate_to_datetime(entry.published)
                if published_dt >= limit_date:
                    all_news.append({
                        'stock': stock,
                        'title': entry.title,
                        'link': entry.link,
                        'published': entry.published,
                        'source': entry.source.title if hasattr(entry, 'source') else 'Google News',
                        'summary': entry.summary if hasattr(entry, 'summary') else '',
                        'published_dt': published_dt # Store for sorting
                    })
            except Exception:
                # If date parsing fails, include it anyway or skip. Including it is safer.
                pass
                
        # Sort by date descending (newest first)
        all_news.sort(key=lambda x: x['published_dt'], reverse=True)
        
        # Remove the datetime object before returning to avoid JSON serialization issues
        for item in all_news:
            del item['published_dt']

        # Limit to top 10 relevant items strictly after sorting could be good, but feed is usually sorted
        return all_news[:10] 

    except Exception as e:
        print(f"Error fetching news for {stock}: {e}")
        
    return all_news

# Helper to get current price
def get_current_price(ticker):
    try:
        # Append .NS for NSE if not present (simple heuristic)
        # Using simple Ticker access for speed
        symbol = ticker if ticker.endswith('.NS') or ticker.endswith('.BO') else f"{ticker}.NS"
        stock = yf.Ticker(symbol)
        # fast_info is faster than history
        price = stock.fast_info.last_price
        return price
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return None

def get_stock_news(request):
    stocks = request.GET.get('stocks', '')
    if not stocks:
        return JsonResponse({'error': 'No stocks provided'}, status=400)
    
    stock_list = [s.strip() for s in stocks.split(',')]
    all_news = []

    for stock in stock_list:
        news_items = fetch_news_data(stock)
        all_news.extend(news_items)
            
    return JsonResponse({'news': all_news})

def get_stock_prices(request):
    stocks = request.GET.get('stocks', '')
    if not stocks:
        return JsonResponse({'error': 'No stocks provided'}, status=400)
    
    stock_list = [s.strip() for s in stocks.split(',')]
    prices = {}
    
    for stock in stock_list:
        price = get_current_price(stock)
        if price:
            prices[stock] = round(price, 2)
        else:
            prices[stock] = "N/A"
            
    return JsonResponse({'prices': prices})

@csrf_exempt
@require_http_methods(["GET"])
def predict_stock(request):
    stock = request.GET.get('stock', '').strip()
    if not stock:
         return JsonResponse({'error': 'Stock is required'}, status=400)
         
    # 1. Get recent news
    news_items = fetch_news_data(stock)
    
    # 2. Get current price
    current_price = get_current_price(stock)
    price_context = f"Current Price: ₹{current_price:.2f}" if current_price else "Current Price: Unknown"

    # 3. Prepare Prompt
    headlines = [item['title'] for item in news_items] if news_items else ["No recent news found."]
    
    prompt = f"""
    Analyze the following for the stock '{stock}':
    {price_context}
    
    Recent headlines:
    {json.dumps(headlines)}
    
    Task:
    1. Predict if the price will go HIGH (Bullish) or LOW (Bearish) short-term.
    2. Estimate a TARGET PRICE or % change (e.g., "+2%"). Be specific but speculative.
    3. Provide a short reason.
    
    Strict JSON format:
    {{"prediction": "HIGH" or "LOW", "target": "e.g. ₹3200" or "+5%", "reason": "Short summary"}}
    """
    
    # 4. Call Ollama
    try:
        ollama_response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': 'llama3', 
                'prompt': prompt,
                'stream': False,
                'format': 'json'
            },
            timeout=45 # Increased timeout for more complex analysis
        )
        
        if ollama_response.status_code == 200:
            result = ollama_response.json()
            analysis = json.loads(result['response']) 
            return JsonResponse(analysis)
        else:
            return JsonResponse({'error': 'Ollama failed'}, status=500)
            
    except requests.exceptions.ConnectionError:
        return JsonResponse({'error': 'Ollama is not running. Please run `ollama serve`.'}, status=503)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def stock_list(request):
    if request.method == "GET":
        stocks = list(Stock.objects.values('id', 'ticker'))
        return JsonResponse({'stocks': stocks})
    
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            ticker = data.get('ticker', '').strip().upper()
            if not ticker:
                return JsonResponse({'error': 'Ticker is required'}, status=400)
            
            stock, created = Stock.objects.get_or_create(ticker=ticker)
            status = 201 if created else 200
            
            return JsonResponse({'stock': {'id': stock.id, 'ticker': stock.ticker}}, status=status)
        except json.JSONDecodeError:
             return JsonResponse({'error': 'Invalid JSON'}, status=400)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_stock(request, stock_id):
    try:
        stock = Stock.objects.get(id=stock_id)
        stock.delete()
        return JsonResponse({'message': 'Stock deleted'})
    except Stock.DoesNotExist:
        return JsonResponse({'error': 'Stock not found'}, status=404)
