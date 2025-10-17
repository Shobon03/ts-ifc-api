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

import { Circle } from 'lucide-react';
import { usePluginStatus } from '../lib/websocket-context';
import { PluginType, PluginStatus } from '../lib/websocket-types';

interface PluginStatusIndicatorProps {
  plugin: PluginType;
  showLabel?: boolean;
  className?: string;
}

export function PluginStatusIndicator({
  plugin,
  showLabel = true,
  className = '',
}: PluginStatusIndicatorProps) {
  const status = usePluginStatus(plugin);

  const getStatusColor = () => {
    switch (status) {
      case PluginStatus.CONNECTED:
        return 'text-green-500';
      case PluginStatus.DISCONNECTED:
        return 'text-gray-400';
      case PluginStatus.ERROR:
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case PluginStatus.CONNECTED:
        return 'Conectado';
      case PluginStatus.DISCONNECTED:
        return 'Desconectado';
      case PluginStatus.ERROR:
        return 'Erro';
      default:
        return 'Desconhecido';
    }
  };

  const getPluginName = () => {
    switch (plugin) {
      case PluginType.REVIT:
        return 'Revit';
      case PluginType.ARCHICAD:
        return 'Archicad';
      default:
        return plugin;
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Circle className={`h-3 w-3 ${getStatusColor()} fill-current`} />
      {showLabel && (
        <span className="text-sm text-gray-700">
          <span className="font-medium">{getPluginName()}</span>: {getStatusText()}
        </span>
      )}
    </div>
  );
}

export function PluginStatusBar() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <span className="text-sm font-medium text-gray-600">Status dos Plugins:</span>
      <PluginStatusIndicator plugin={PluginType.REVIT} />
      <PluginStatusIndicator plugin={PluginType.ARCHICAD} />
    </div>
  );
}
