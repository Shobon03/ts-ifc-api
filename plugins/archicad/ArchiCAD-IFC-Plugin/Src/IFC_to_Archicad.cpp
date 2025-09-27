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

#include "APIEnvir.h"
#include "ACAPinc.h"

#include "Resources.hpp"

#include "IFCAPI_Test.hpp"


enum APITestMenu {
	LoadIFCFileMenuItem = 1,
	SaveProjectAsPLNMenuItem,
	ExportProjectAsIFCMenuItem
};


GSErrCode MenuCommandHandler (const API_MenuParams *menuParams)
{
	switch (menuParams->menuItemRef.menuResID) {
		case IFCAPI_TEST_MENU_STRINGS:
			{
				switch (menuParams->menuItemRef.itemIndex) {
					case LoadIFCFileMenuItem: LoadIFCFile (); break;
					case SaveProjectAsPLNMenuItem: SaveProjectAsPln (); break;
					case ExportProjectAsIFCMenuItem: ExportProjectAsIFC (); break;
				}
				break;
			}
		default:
			DBBREAK_STR ("Unhandled menu item!"); break;
	}

	ACAPI_KeepInMemory (true);

	return NoError;
}


API_AddonType CheckEnvironment (API_EnvirParams* envir)
{
	if (envir->serverInfo.serverApplication != APIAppl_ArchiCADID)
		return APIAddon_DontRegister;

	RSGetIndString (&envir->addOnInfo.name, IFC_TO_ARCHICAD_ADDON_NAME, 1, ACAPI_GetOwnResModule ());
	RSGetIndString (&envir->addOnInfo.description, IFC_TO_ARCHICAD_ADDON_NAME, 2, ACAPI_GetOwnResModule ());

	return APIAddon_Normal;
}


GSErrCode RegisterInterface (void)
{
	GSErrCode err = ACAPI_MenuItem_RegisterMenu (IFCAPI_TEST_MENU_STRINGS, IFCAPI_TEST_MENU_PROMPT_STRINGS, MenuCode_UserDef, MenuFlag_InsertIntoSame);

	DBASSERT (err == NoError);

	return err;
}


GSErrCode Initialize (void)
{
	GSErrCode err = ACAPI_MenuItem_InstallMenuHandler (IFCAPI_TEST_MENU_STRINGS, MenuCommandHandler);

	DBASSERT (err == NoError);

	return err;
}


GSErrCode FreeData (void)
{
	return NoError;
}
