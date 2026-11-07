from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # API Schema
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Authentication
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # OAuth2
    path('o/', include('oauth2_provider.urls', namespace='oauth2_provider')),

    # Apps
    path('api/users/', include('apps.users.urls')),
    path('api/alerts/', include('apps.alerts.urls')),
    path('api/cases/', include('apps.cases.urls')),
    path('api/detection/', include('apps.detection.urls')),
    path('api/connectors/', include('apps.connectors.urls')),
    path('api/threatintel/', include('apps.threatintel.urls')),
    path('api/ai/', include('apps.ai.urls')),
    path('api/playbooks/', include('apps.playbooks.urls')),
    path('api/network/', include('apps.network.urls')),

    # Health checks
    path('health/', include('health_check.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Custom error handlers
handler400 = 'config.exceptions.bad_request'
handler403 = 'config.exceptions.permission_denied'
handler404 = 'config.exceptions.not_found'
handler500 = 'config.exceptions.server_error'