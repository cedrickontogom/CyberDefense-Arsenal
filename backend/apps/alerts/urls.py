from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConnectorViewSet, AlertViewSet, AlertCommentViewSet,
    AlertAttachmentViewSet, AlertRuleViewSet, IngestionMetricsViewSet
)

router = DefaultRouter()
router.register(r'connectors', ConnectorViewSet, basename='connector')
router.register(r'alerts', AlertViewSet, basename='alert')
router.register(r'rules', AlertRuleViewSet, basename='alertrule')
router.register(r'metrics', IngestionMetricsViewSet, basename='ingestionmetrics')

# Nested routes
urlpatterns = [
    path('', include(router.urls)),
    path('alerts/<uuid:alert_pk>/comments/', AlertCommentViewSet.as_view({'get': 'list', 'post': 'create'}), name='alert-comments'),
    path('alerts/<uuid:alert_pk>/comments/<uuid:pk>/', AlertCommentViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='alert-comment-detail'),
    path('alerts/<uuid:alert_pk>/attachments/', AlertAttachmentViewSet.as_view({'get': 'list', 'post': 'create'}), name='alert-attachments'),
    path('alerts/<uuid:alert_pk>/attachments/<uuid:pk>/', AlertAttachmentViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='alert-attachment-detail'),
]