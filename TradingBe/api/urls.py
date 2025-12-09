from django.urls import path
from .views import get_stock_news, stock_list, delete_stock, predict_stock, get_stock_prices

urlpatterns = [
    path('news/', get_stock_news, name='stock_news'),
    path('stocks/', stock_list, name='stock_list'),
    path('stocks/<int:stock_id>/', delete_stock, name='delete_stock'),
    path('predict/', predict_stock, name='predict_stock'),
    path('prices/', get_stock_prices, name='stock_prices'),
]
