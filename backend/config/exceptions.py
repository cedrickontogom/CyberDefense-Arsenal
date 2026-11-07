import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler for DRF."""
    response = exception_handler(exc, context)

    if response is not None:
        # Standardize error response format
        error_data = {
            'error': {
                'code': response.status_code,
                'message': get_error_message(response.data),
                'details': response.data if isinstance(response.data, dict) else None,
            }
        }
        response.data = error_data

    return response


def get_error_message(data):
    """Extract human-readable error message from response data."""
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        if 'non_field_errors' in data:
            return str(data['non_field_errors'][0])
        # Get first field error
        for key, value in data.items():
            if isinstance(value, list) and value:
                return f"{key}: {value[0]}"
            elif isinstance(value, str):
                return f"{key}: {value}"
    elif isinstance(data, list) and data:
        return str(data[0])
    return "An error occurred"


@csrf_exempt
def bad_request(request, exception=None):
    """Handle 400 Bad Request."""
    return JsonResponse({
        'error': {
            'code': 400,
            'message': 'Bad Request',
            'details': str(exception) if exception else None,
        }
    }, status=400)


@csrf_exempt
def permission_denied(request, exception=None):
    """Handle 403 Forbidden."""
    return JsonResponse({
        'error': {
            'code': 403,
            'message': 'Permission Denied',
            'details': str(exception) if exception else None,
        }
    }, status=403)


@csrf_exempt
def not_found(request, exception=None):
    """Handle 404 Not Found."""
    return JsonResponse({
        'error': {
            'code': 404,
            'message': 'Not Found',
            'details': str(exception) if exception else None,
        }
    }, status=404)


@csrf_exempt
def server_error(request):
    """Handle 500 Server Error."""
    logger.exception("Server error occurred")
    return JsonResponse({
        'error': {
            'code': 500,
            'message': 'Internal Server Error',
            'details': 'An unexpected error occurred. Please contact support.',
        }
    }, status=500)