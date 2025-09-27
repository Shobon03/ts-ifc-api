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

#ifndef	_APIENVIR_H_
#define	_APIENVIR_H_


#if defined (_MSC_VER)
	#if !defined (WINDOWS)
		#define WINDOWS
	#endif
#endif

#if defined (WINDOWS)
	#include "Win32Interface.hpp"
#endif

#if defined (macintosh)
	#include <CoreServices/CoreServices.h>
#endif

#if !defined (ACExtension)
	#define ACExtension
#endif


#endif
