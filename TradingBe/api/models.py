from django.db import models

from django.contrib.auth.models import User

class Stock(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True) # Temporarily nullable for migration
    ticker = models.CharField(max_length=10) # Removed unique=True to allow multiple users to have same stock
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.ticker
