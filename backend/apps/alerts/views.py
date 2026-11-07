from django.utils import timezone
from django.db.models import Q, Count, F
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import Connector, Alert, AlertComment, AlertAttachment, AlertRule, IngestionMetrics
from .serializers import (
    ConnectorSerializer, ConnectorListSerializer, AlertSerializer, AlertListSerializer,
    AlertCreateSerializer, AlertUpdateSerializer, AlertTriageSerializer,
    AlertBulkActionSerializer, AlertCommentSerializer, AlertAttachmentSerializer,
    AlertRuleSerializer, IngestionMetricsSerializer
)
from apps.users.permissions import HasPermission, IsSelfOrAdmin
from apps.users.models import AuditLog


class ConnectorViewSet(viewsets.ModelViewSet):
    queryset = Connector.objects.select_related('created_by').all()
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'alerts.view_connector',
        'retrieve': 'alerts.view_connector',
        'create': 'alerts.add_connector',
        'update': 'alerts.change_connector',
        'partial_update': 'alerts.change_connector',
        'destroy': 'alerts.delete_connector',
        'test': 'alerts.change_connector',
        'metrics': 'alerts.view_connector',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['connector_type', 'status', 'is_active']
    search_fields = ['name']
    ordering_fields = ['created_at', 'last_run', 'total_events']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ConnectorListSerializer
        return ConnectorSerializer

    def perform_create(self, serializer):
        connector = serializer.save(created_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user,
            action='create',
            resource_type='connector',
            resource_id=str(connector.id),
            changes={'name': connector.name, 'type': connector.connector_type},
            success=True,
        )

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        connector = self.get_object()
        # Test connector connection
        try:
            # Implementation depends on connector type
            result = self._test_connector(connector)
            connector.status = 'active' if result['success'] else 'error'
            connector.last_error = '' if result['success'] else result.get('error', '')
            connector.save(update_fields=['status', 'last_error'])
            return Response(result)
        except Exception as e:
            connector.status = 'error'
            connector.last_error = str(e)
            connector.save(update_fields=['status', 'last_error'])
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def enable(self, request, pk=None):
        connector = self.get_object()
        connector.is_active = True
        connector.save(update_fields=['is_active'])
        return Response({'detail': 'Connector enabled'})

    @action(detail=True, methods=['post'])
    def disable(self, request, pk=None):
        connector = self.get_object()
        connector.is_active = False
        connector.save(update_fields=['is_active'])
        return Response({'detail': 'Connector disabled'})

    @action(detail=True, methods=['get'])
    def metrics(self, request, pk=None):
        connector = self.get_object()
        metrics = IngestionMetrics.objects.filter(connector=connector).order_by('-timestamp')[:100]
        serializer = IngestionMetricsSerializer(metrics, many=True)
        return Response(serializer.data)

    def _test_connector(self, connector):
        # Placeholder for connector-specific tests
        return {'success': True, 'message': 'Connection test not implemented for this connector type'}


class AlertViewSet(viewsets.ModelViewSet):
    queryset = Alert.objects.select_related('connector', 'assigned_to', 'parent_alert').prefetch_related('child_alerts').all()
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'alerts.view_alert',
        'retrieve': 'alerts.view_alert',
        'create': 'alerts.add_alert',
        'update': 'alerts.change_alert',
        'partial_update': 'alerts.change_alert',
        'destroy': 'alerts.delete_alert',
        'triage': 'alerts.change_alert',
        'bulk_action': 'alerts.change_alert',
        'comments': 'alerts.view_alert',
        'add_comment': 'alerts.add_alertcomment',
        'attachments': 'alerts.view_alert',
        'upload_attachment': 'alerts.add_alertattachment',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'severity': ['exact', 'in'],
        'status': ['exact', 'in'],
        'connector': ['exact'],
        'host': ['exact', 'icontains'],
        'user': ['exact', 'icontains'],
        'source_ip': ['exact'],
        'assigned_to': ['exact', 'isnull'],
        'is_correlated': ['exact'],
        'occurred_at': ['gte', 'lte', 'date'],
        'received_at': ['gte', 'lte', 'date'],
        'tags': ['contains', 'overlap'],
    }
    search_fields = ['title', 'description', 'alert_id', 'host', 'user']
    ordering_fields = ['occurred_at', 'received_at', 'severity', 'status', 'created_at']
    ordering = ['-occurred_at']
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return AlertListSerializer
        elif self.action == 'create':
            return AlertCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return AlertUpdateSerializer
        return AlertSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Apply alert rules for filtering
        return queryset

    @action(detail=True, methods=['post'])
    def triage(self, request, pk=None):
        alert = self.get_object()
        serializer = AlertTriageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        old_status = alert.status
        old_assigned = alert.assigned_to_id

        alert.status = serializer.validated_data['status']
        if 'assigned_to' in serializer.validated_data:
            alert.assigned_to_id = serializer.validated_data['assigned_to']
            alert.assigned_at = timezone.now() if serializer.validated_data['assigned_to'] else None

        if serializer.validated_data.get('tags'):
            alert.tags = list(set(alert.tags + serializer.validated_data['tags']))

        if alert.status in ['resolved', 'closed', 'false_positive'] and not alert.resolved_at:
            alert.resolved_at = timezone.now()
        elif alert.status == 'triaged' and not alert.triaged_at:
            alert.triaged_at = timezone.now()

        alert.save()

        # Log comment if provided
        if serializer.validated_data.get('comment'):
            AlertComment.objects.create(
                alert=alert,
                user=request.user,
                content=serializer.validated_data['comment'],
                is_internal=True,
            )

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            action='triage',
            resource_type='alert',
            resource_id=str(alert.id),
            changes={
                'old_status': old_status,
                'new_status': alert.status,
                'old_assigned_to': str(old_assigned) if old_assigned else None,
                'new_assigned_to': str(alert.assigned_to_id) if alert.assigned_to_id else None,
            },
            success=True,
        )

        return Response(AlertSerializer(alert, context={'request': request}).data)

    @action(detail=False, methods=['post'])
    def bulk_action(self, request):
        serializer = AlertBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        alert_ids = serializer.validated_data['alert_ids']
        action = serializer.validated_data['action']
        params = serializer.validated_data['parameters']

        alerts = Alert.objects.filter(id__in=alert_ids)
        count = alerts.count()

        if action == 'assign':
            alerts.update(assigned_to_id=params.get('user_id'), assigned_at=timezone.now())
        elif action == 'unassign':
            alerts.update(assigned_to=None, assigned_at=None)
        elif action == 'change_status':
            alerts.update(status=params.get('status'))
            if params.get('status') in ['resolved', 'closed', 'false_positive']:
                alerts.filter(resolved_at__isnull=True).update(resolved_at=timezone.now())
        elif action == 'add_tags':
            tags = params.get('tags', [])
            for alert in alerts:
                alert.tags = list(set(alert.tags + tags))
                alert.save(update_fields=['tags'])
        elif action == 'remove_tags':
            tags = params.get('tags', [])
            for alert in alerts:
                alert.tags = [t for t in alert.tags if t not in tags]
                alert.save(update_fields=['tags'])
        elif action == 'mark_false_positive':
            alerts.update(status='false_positive', resolved_at=timezone.now())
        elif action == 'mark_duplicate':
            primary_id = params.get('primary_alert_id')
            if primary_id:
                primary = Alert.objects.get(id=primary_id)
                alerts.exclude(id=primary_id).update(
                    status='duplicate', parent_alert=primary, is_correlated=True
                )
        elif action == 'merge':
            # Merge alerts into a single case
            pass

        return Response({'detail': f'Action {action} applied to {count} alerts'})

    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        alert = self.get_object()
        if request.method == 'GET':
            comments = alert.comments.select_related('user').all()
            serializer = AlertCommentSerializer(comments, many=True, context={'request': request})
            return Response(serializer.data)

        serializer = AlertCommentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(alert=alert, user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'])
    def attachments(self, request, pk=None):
        alert = self.get_object()
        if request.method == 'GET':
            attachments = alert.attachments.select_related('uploaded_by').all()
            serializer = AlertAttachmentSerializer(attachments, many=True, context={'request': request})
            return Response(serializer.data)

        serializer = AlertAttachmentSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save(alert=alert, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        alert = self.get_object()
        events = []

        # Main alert event
        events.append({
            'type': 'alert_created',
            'timestamp': alert.received_at,
            'data': {'title': alert.title, 'severity': alert.severity},
        })

        # Comments
        for comment in alert.comments.select_related('user').all():
            events.append({
                'type': 'comment',
                'timestamp': comment.created_at,
                'data': {'user': comment.user.email, 'content': comment.content, 'internal': comment.is_internal},
            })

        # Status changes from history
        for history in alert.history.all():
            if history.status != getattr(history.prev_record, 'status', None) if history.prev_record else None:
                events.append({
                    'type': 'status_change',
                    'timestamp': history.history_date,
                    'data': {
                        'old_status': getattr(history.prev_record, 'status', None) if history.prev_record else None,
                        'new_status': history.status,
                        'user': history.history_user.email if history.history_user else 'System',
                    },
                })

        events.sort(key=lambda x: x['timestamp'])
        return Response(events)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        stats = {
            'total': queryset.count(),
            'by_severity': dict(queryset.values_list('severity').annotate(count=Count('id'))),
            'by_status': dict(queryset.values_list('status').annotate(count=Count('id'))),
            'by_connector': dict(queryset.values_list('connector__name').annotate(count=Count('id'))),
            'unassigned': queryset.filter(assigned_to__isnull=True).count(),
            'overdue': queryset.filter(
                status__in=['new', 'triaged', 'investigating'],
                occurred_at__lt=timezone.now() - timezone.timedelta(hours=24)
            ).count(),
        }
        return Response(stats)

    @action(detail=False, methods=['get'])
    def export(self, request):
        # Export alerts as CSV/JSON
        queryset = self.filter_queryset(self.get_queryset())[:10000]
        serializer = AlertListSerializer(queryset, many=True)
        return Response(serializer.data)


class AlertCommentViewSet(viewsets.ModelViewSet):
    serializer_class = AlertCommentSerializer
    permission_classes = [IsAuthenticated, IsSelfOrAdmin]

    def get_queryset(self):
        return AlertComment.objects.filter(alert_id=self.kwargs['alert_pk']).select_related('user')

    def perform_create(self, serializer):
        serializer.save(
            alert_id=self.kwargs['alert_pk'],
            user=self.request.user
        )


class AlertAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AlertAttachmentSerializer
    permission_classes = [IsAuthenticated, IsSelfOrAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return AlertAttachment.objects.filter(alert_id=self.kwargs['alert_pk']).select_related('uploaded_by')

    def perform_create(self, serializer):
        file_obj = self.request.FILES['file']
        serializer.save(
            alert_id=self.kwargs['alert_pk'],
            uploaded_by=self.request.user,
            filename=file_obj.name,
            content_type=file_obj.content_type,
            size=file_obj.size,
        )


class AlertRuleViewSet(viewsets.ModelViewSet):
    queryset = AlertRule.objects.select_related('created_by').all()
    serializer_class = AlertRuleSerializer
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'alerts.view_alertrule',
        'retrieve': 'alerts.view_alertrule',
        'create': 'alerts.add_alertrule',
        'update': 'alerts.change_alertrule',
        'partial_update': 'alerts.change_alertrule',
        'destroy': 'alerts.delete_alertrule',
    }
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['rule_type', 'is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['priority', 'created_at', 'match_count']
    ordering = ['priority', 'name']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class IngestionMetricsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IngestionMetrics.objects.select_related('connector').all()
    serializer_class = IngestionMetricsSerializer
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'alerts.view_ingestionmetrics',
        'retrieve': 'alerts.view_ingestionmetrics',
    }
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['connector']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']