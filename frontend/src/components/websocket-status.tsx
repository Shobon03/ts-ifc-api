/*
 * Copyright (C) 2025 Matheus Piovezan Teixeira
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { useWebSocketContext } from '../lib/websocket-context';

interface WebSocketStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function WebSocketStatus({
  className = '',
  showDetails = false,
}: WebSocketStatusProps) {
  const { isConnected, isReconnecting, error, reconnectCount } =
    useWebSocketContext();

  const getStatusColor = () => {
    if (error && !isReconnecting) return 'text-red-500';
    if (isReconnecting) return 'text-yellow-500';
    if (isConnected) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusText = () => {
    if (error && !isReconnecting) return 'Disconectado';
    if (isReconnecting) return `Reconectando... (${reconnectCount})`;
    if (isConnected) return 'Conectado';
    return 'Conectando...';
  };

  const getStatusIcon = () => {
    if (error && !isReconnecting) return '🔴';
    if (isReconnecting) return '🟡';
    if (isConnected) return '🟢';
    return '⚪';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className='text-sm'>{getStatusIcon()}</span>
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      {showDetails && error && (
        <span className='text-xs text-red-400 ml-2'>{error}</span>
      )}
    </div>
  );
}
