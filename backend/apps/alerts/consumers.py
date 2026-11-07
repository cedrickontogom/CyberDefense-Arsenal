import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model

User = get_user_model()


class AlertConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time alert updates."""

    async def connect(self):
        self.user = self.scope['user']
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Join alert room
        self.room_group_name = 'alerts'
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Send initial connection confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to alerts stream',
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'subscribe':
            # Subscribe to specific alert filters
            filters = data.get('filters', {})
            await self.send(text_data=json.dumps({
                'type': 'subscribed',
                'filters': filters,
            }))

        elif message_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))

    # Handler for broadcast messages
    async def alert_created(self, event):
        await self.send(text_data=json.dumps({
            'type': 'alert_created',
            'alert': event['alert'],
        }))

    async def alert_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'alert_updated',
            'alert': event['alert'],
        }))

    async def alert_deleted(self, event):
        await self.send(text_data=json.dumps({
            'type': 'alert_deleted',
            'alert_id': event['alert_id'],
        }))

    async def bulk_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'bulk_update',
            'alert_ids': event['alert_ids'],
            'changes': event['changes'],
        }))

    async def stats_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'stats_update',
            'stats': event['stats'],
        }))