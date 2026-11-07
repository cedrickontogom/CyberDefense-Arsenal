import secrets
import pyotp
import qrcode
import io
import base64
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from guardian.shortcuts import assign_perm, remove_perm, get_perms

from .models import Role, Permission, UserRole, APIKey, UserSession, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, MFASetupSerializer, MFAVerifySerializer,
    RoleSerializer, RoleCreateUpdateSerializer, PermissionSerializer,
    APIKeySerializer, APIKeyCreateSerializer, UserSessionSerializer, AuditLogSerializer
)
from .permissions import IsAdminUser, IsSelfOrAdmin, HasPermission

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(email=request.data.get('email'))
            # Track failed attempts
            user.failed_login_attempts = 0
            user.locked_until = None
            user.last_login_ip = request.META.get('REMOTE_ADDR')
            user.save(update_fields=['failed_login_attempts', 'locked_until', 'last_login_ip'])

            # Create session record
            refresh = RefreshToken.for_user(user)
            UserSession.objects.create(
                user=user,
                session_key=str(refresh.access_token.jti),
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                expires_at=timezone.now() + timedelta(days=7),
            )

            # Audit log
            AuditLog.objects.create(
                user=user,
                action='login',
                resource_type='session',
                resource_id=str(refresh.access_token.jti),
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT', ''),
                success=True,
            )
        return response


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related().prefetch_related('roles', 'direct_permissions').all()
    permission_classes = [IsAuthenticated, IsSelfOrAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return self.queryset
        return self.queryset.filter(id=user.id)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password changed successfully'})

    @action(detail=False, methods=['get', 'post'])
    def mfa(self, request):
        user = request.user

        if request.method == 'GET':
            if user.mfa_enabled:
                return Response({'enabled': True})
            return Response({'enabled': False})

        # Setup MFA
        if user.mfa_enabled:
            return Response({'detail': 'MFA already enabled'}, status=status.HTTP_400_BAD_REQUEST)

        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(user.email, issuer_name='CyberDefense Arsenal')

        # Generate QR code
        qr = qrcode.make(provisioning_uri)
        buffer = io.BytesIO()
        qr.save(buffer, format='PNG')
        qr_code = base64.b64encode(buffer.getvalue()).decode()

        # Generate recovery codes
        recovery_codes = [secrets.token_hex(4).upper() for _ in range(10)]

        # Store temporarily (not activated until verified)
        request.session['mfa_secret'] = secret
        request.session['mfa_recovery_codes'] = recovery_codes

        return Response({
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_code}',
            'recovery_codes': recovery_codes,
        })

    @action(detail=False, methods=['post'])
    def mfa_verify(self, request):
        user = request.user
        serializer = MFAVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code']
        recovery_code = serializer.validated_data.get('recovery_code')

        secret = request.session.get('mfa_secret')
        recovery_codes = request.session.get('mfa_recovery_codes', [])

        verified = False

        if recovery_code and recovery_code in recovery_codes:
            verified = True
            recovery_codes.remove(recovery_code)
        elif secret:
            totp = pyotp.TOTP(secret)
            verified = totp.verify(code, valid_window=1)

        if not verified:
            return Response({'detail': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

        # Activate MFA
        user.mfa_enabled = True
        user.mfa_secret = secret
        user.mfa_recovery_codes = recovery_codes
        user.save(update_fields=['mfa_enabled', 'mfa_secret', 'mfa_recovery_codes'])

        # Clear session
        request.session.pop('mfa_secret', None)
        request.session.pop('mfa_recovery_codes', None)

        return Response({'detail': 'MFA enabled successfully', 'recovery_codes': recovery_codes})

    @action(detail=False, methods=['post'])
    def mfa_disable(self, request):
        user = request.user
        if not user.mfa_enabled:
            return Response({'detail': 'MFA not enabled'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = MFAVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data['code']
        recovery_code = serializer.validated_data.get('recovery_code')

        verified = False
        if recovery_code and recovery_code in user.mfa_recovery_codes:
            verified = True
        elif user.mfa_secret:
            totp = pyotp.TOTP(user.mfa_secret)
            verified = totp.verify(code, valid_window=1)

        if not verified:
            return Response({'detail': 'Invalid code'}, status=status.HTTP_400_BAD_REQUEST)

        user.mfa_enabled = False
        user.mfa_secret = ''
        user.mfa_recovery_codes = []
        user.save(update_fields=['mfa_enabled', 'mfa_secret', 'mfa_recovery_codes'])

        return Response({'detail': 'MFA disabled successfully'})

    @action(detail=False, methods=['get'])
    def sessions(self, request):
        sessions = UserSession.objects.filter(user=request.user, expires_at__gt=timezone.now())
        serializer = UserSessionSerializer(sessions, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='sessions/(?P<session_id>[^/.]+)/revoke')
    def revoke_session(self, request, pk=None, session_id=None):
        user = self.get_object()
        if user != request.user and not request.user.is_superuser:
            return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        try:
            session = UserSession.objects.get(id=session_id, user=user)
            session.delete()
            return Response({'detail': 'Session revoked'})
        except UserSession.DoesNotExist:
            return Response({'detail': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])
    def revoke_all_sessions(self, request):
        UserSession.objects.filter(user=request.user).exclude(
            session_key=request.auth.get('jti') if request.auth else ''
        ).delete()
        return Response({'detail': 'All other sessions revoked'})


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'users.view_role',
        'retrieve': 'users.view_role',
        'create': 'users.add_role',
        'update': 'users.change_role',
        'partial_update': 'users.change_role',
        'destroy': 'users.delete_role',
    }

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RoleCreateUpdateSerializer
        return RoleSerializer


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'users.view_permission',
        'retrieve': 'users.view_permission',
    }


class APIKeyViewSet(viewsets.ModelViewSet):
    serializer_class = APIKeySerializer
    permission_classes = [IsAuthenticated, IsSelfOrAdmin]

    def get_queryset(self):
        return APIKey.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'create':
            return APIKeyCreateSerializer
        return APIKeySerializer

    def perform_create(self, serializer):
        # Generate API key
        key = secrets.token_urlsafe(32)
        key_hash = make_password(key)
        key_prefix = key[:8]

        api_key = serializer.save(
            user=self.request.user,
            key_hash=key_hash,
            key_prefix=key_prefix,
        )

        # Return full key only once
        api_key.full_key = f"{key_prefix}.{key}"
        return api_key

    @action(detail=True, methods=['post'])
    def rotate(self, request, pk=None):
        api_key = self.get_object()
        key = secrets.token_urlsafe(32)
        api_key.key_hash = make_password(key)
        api_key.key_prefix = key[:8]
        api_key.save(update_fields=['key_hash', 'key_prefix'])

        api_key.full_key = f"{api_key.key_prefix}.{key}"
        serializer = self.get_serializer(api_key)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        api_key = self.get_object()
        api_key.is_active = False
        api_key.save(update_fields=['is_active'])
        return Response({'detail': 'API key revoked'})


class UserSessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserSession.objects.filter(user=self.request.user, expires_at__gt=timezone.now())


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, HasPermission]
    required_permissions = {
        'list': 'users.view_auditlog',
        'retrieve': 'users.view_auditlog',
    }

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return AuditLog.objects.select_related('user').all()
        return AuditLog.objects.filter(user=user).select_related('user')