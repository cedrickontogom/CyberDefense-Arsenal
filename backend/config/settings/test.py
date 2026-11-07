from .base import *

# Test settings
DEBUG = True
SECRET_KEY = 'test-secret-key-not-for-production'

# Use in-memory SQLite for tests
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable migrations for faster tests
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# Use dummy cache
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Celery eager mode for tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Disable password hashing for speed
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# JWT shorter lifetime for tests
SIMPLE_JWT = {
    **SIMPLE_JWT,
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(minutes=10),
}

# Disable rate limiting
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {}

# Logging - reduce noise
LOGGING['root']['level'] = 'WARNING'
LOGGING['loggers']['apps']['level'] = 'WARNING'
LOGGING['loggers']['django']['level'] = 'WARNING'

# Disable external services
CYBERDEFENSE['OLLAMA_URL'] = 'http://localhost:11434'
CYBERDEFENSE['CLICKHOUSE_URL'] = 'http://localhost:8123'
CYBERDEFENSE['NEO4J_URI'] = 'bolt://localhost:7687'
CYBERDEFENSE['OPENSEARCH_URL'] = 'http://localhost:9200'
CYBERDEFENSE['KAFKA_BOOTSTRAP_SERVERS'] = 'localhost:9092'
CYBERDEFENSE['NETWORK_SCANNER_URL'] = 'http://localhost:7331'

# Test-specific settings
TEST_RUNNER = 'django.test.runner.DiscoverRunner'