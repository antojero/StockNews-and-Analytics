from django.urls import path
from .views import get_stock_news, stock_list, delete_stock, predict_stock, get_stock_prices, RegisterView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('news/', get_stock_news, name='get_stock_news'),
    path('stocks/', stock_list, name='stock_list'),
    path('stocks/<int:stock_id>/', delete_stock, name='delete_stock'),
    path('predict/', predict_stock, name='predict_stock'),
    path('prices/', get_stock_prices, name='get_stock_prices'),
]
