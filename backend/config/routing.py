from django.urls import re_path
from apps.alerts.consumers import AlertConsumer
from apps.cases.consumers import CaseConsumer
from apps.ai.consumers import InvestigationConsumer
from apps.network.consumers import NetworkScanConsumer

websocket_urlpatterns = [
    re_path(r'ws/alerts/$', AlertConsumer.as_asgi()),
    re_path(r'ws/cases/(?P<case_id>[^/]+)/$', CaseConsumer.as_asgi()),
    re_path(r'ws/investigation/(?P<case_id>[^/]+)/$', InvestigationConsumer.as_asgi()),
    re_path(r'ws/network/scan/(?P<scan_id>[^/]+)/$', NetworkScanConsumer.as_asgi()),
]