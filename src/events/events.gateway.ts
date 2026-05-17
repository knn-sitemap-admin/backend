import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // 매물핀 관련 이벤트
  broadcastPinUpdated(payload: { pinId: string; action: 'created' | 'updated' | 'deleted' }) {
    this.server.emit('pin_updated', payload);
  }

  // 임시핀(답사예정) 관련 이벤트
  broadcastReservationChanged(payload: { draftId?: string; reservationId?: string; action: 'created' | 'updated' | 'deleted' }) {
    this.server.emit('reservation_changed', payload);
  }
}
