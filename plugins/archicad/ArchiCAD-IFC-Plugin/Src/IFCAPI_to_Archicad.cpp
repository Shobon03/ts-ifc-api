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

#include "Resources.hpp"
#include "APIEnvir.h"
#include "ACAPinc.h"
#include "DGModule.hpp"
#include "File.hpp"
#include <ctime>

void LoadIFCFile ()
{
	IO::Location ifcFileLocation;
	ifcFileLocation.Set ("C:\\Users\\Matheus\\Desktop\\example.ifc");

	if (ifcFileLocation.GetStatus() != NoError) {
		DGAlert (DG_ERROR, GS::UniString ("Error"), GS::UniString ("IFC file not found!"), ifcFileLocation.ToDisplayText(), GS::UniString ("OK"));
		return;
	}

	IO::File ifcFile (ifcFileLocation);
	if (ifcFile.GetStatus() != NoError) {
		DGAlert (DG_ERROR, GS::UniString ("Error"), GS::UniString ("Cannot access IFC file. Please check if the file exists and you have permission to read it."), ifcFileLocation.ToDisplayText(), GS::UniString ("OK"));
		return;
	}

	API_FileOpenPars openPars;
	BNZeroMemory (&openPars, sizeof (API_FileOpenPars));

	openPars.fileTypeID = APIFType_IfcFile;
	openPars.useStoredLib = true;
	openPars.libGiven = false;
	openPars.file = new IO::Location (ifcFileLocation);

	GSErrCode err = ACAPI_ProjectOperation_Open (&openPars);
	if (err != NoError) {
		GS::UniString errorMsg = GS::UniString::Printf ("Error opening IFC file. Error code: %d", err);
		DGAlert (DG_ERROR, GS::UniString ("Error"), errorMsg, GS::UniString (), GS::UniString ("OK"));
	} else {
		DGAlert (DG_INFORMATION, GS::UniString ("Success"), GS::UniString ("IFC file opened successfully! (Note: This replaces the current project)"), ifcFileLocation.ToDisplayText(), GS::UniString ("OK"));
	}

	delete openPars.file;
}

void SaveProjectAsPln ()
{
	API_FileSavePars savePars;
	BNZeroMemory (&savePars, sizeof (API_FileSavePars));

	savePars.fileTypeID = APIFType_PlanFile;

	// Criar nome do arquivo com data atual
	tm currentTime;
	time_t rawTime;
	time (&rawTime);
	localtime_s (&currentTime, &rawTime);

	char dateStr[32];
	strftime (dateStr, sizeof(dateStr), "%Y-%m-%d_%H-%M-%S", &currentTime);

	GS::UniString fileName = GS::UniString::Printf ("pln-exportado-%s.pln", dateStr);

	// Caminho do desktop
	IO::Location desktopLocation;
	desktopLocation.Set ("C:\\Users\\Matheus\\Desktop");
	desktopLocation.AppendToLocal (IO::Name (fileName));

	savePars.file = new IO::Location (desktopLocation);

	GSErrCode err = ACAPI_ProjectOperation_Save (&savePars);
	if (err != NoError) {
		GS::UniString errorMsg = GS::UniString::Printf ("Error saving project. Error code: %d", err);
		DGAlert (DG_ERROR, GS::UniString ("Error"), errorMsg, GS::UniString (), GS::UniString ("OK"));
	} else {
		DGAlert (DG_INFORMATION, GS::UniString ("Success"), GS::UniString ("Project saved successfully!"), desktopLocation.ToDisplayText(), GS::UniString ("OK"));
	}

	delete savePars.file;
}

void ExportProjectAsIFC ()
{
	DGAlert (DG_INFORMATION, GS::UniString ("Debug"), GS::UniString ("Starting IFC Export"), GS::UniString (), GS::UniString ("OK"));

	API_FileSavePars savePars;
	BNZeroMemory (&savePars, sizeof (API_FileSavePars));
	savePars.fileTypeID = APIFType_IfcFile;

	DGAlert (DG_INFORMATION, GS::UniString ("Debug"), GS::UniString ("FileSavePars initialized"), GS::UniString (), GS::UniString ("OK"));

	// Obter tradutor IFC disponível
	GS::Array<API_IFCTranslatorIdentifier> ifcTranslators;
	GSErrCode translatorErr = ACAPI_IFC_GetIFCExportTranslatorsList (ifcTranslators);
	if (translatorErr != NoError || ifcTranslators.IsEmpty ()) {
		DGAlert (DG_ERROR, GS::UniString ("Error"), GS::UniString::Printf ("No IFC translators available. Error: %d", translatorErr), GS::UniString (), GS::UniString ("OK"));
		delete savePars.file;
		return;
	}

	// Inicializar parâmetros IFC com valores padrão seguros
	API_SavePars_Ifc ifcPars;
	ifcPars.subType = API_IFC;
	ifcPars.translatorIdentifier = ifcTranslators[0]; // Usar o primeiro tradutor disponível
	ifcPars.elementsToIfcExport = API_EntireProject;
	ifcPars.elementsSet = nullptr;
	ifcPars.includeBoundingBoxGeometry = false;
	ifcPars.filler_1 = nullptr;
	ifcPars.filler_2 = nullptr;

	DGAlert (DG_INFORMATION, GS::UniString ("Debug"), GS::UniString ("IFC Pars initialized"), GS::UniString (), GS::UniString ("OK"));

	// Criar nome do arquivo com data atual
	tm currentTime;
	time_t rawTime;
	time (&rawTime);
	localtime_s (&currentTime, &rawTime);

	char dateStr[32];
	strftime (dateStr, sizeof(dateStr), "%Y-%m-%d_%H-%M-%S", &currentTime);

	GS::UniString fileName = GS::UniString::Printf ("ifc-exportado-%s.ifc", dateStr);

	// Caminho do desktop
	IO::Location desktopLocation;
	desktopLocation.Set ("C:\\Users\\Matheus\\Desktop");
	desktopLocation.AppendToLocal (IO::Name (fileName));

	savePars.file = new IO::Location (desktopLocation);

	DGAlert (DG_INFORMATION, GS::UniString ("Debug"), GS::UniString ("About to call ACAPI_ProjectOperation_Save"), GS::UniString (), GS::UniString ("OK"));

	GSErrCode err = NoError;
	try {
		err = ACAPI_ProjectOperation_Save (&savePars, &ifcPars);
	} catch (...) {
		DGAlert (DG_ERROR, GS::UniString ("Error"), GS::UniString ("Exception caught during IFC export"), GS::UniString (), GS::UniString ("OK"));
		delete savePars.file;
		return;
	}

	DGAlert (DG_INFORMATION, GS::UniString ("Debug"), GS::UniString::Printf ("ACAPI_ProjectOperation_Save returned: %d", err), GS::UniString (), GS::UniString ("OK"));

	if (err != NoError) {
		GS::UniString errorMsg = GS::UniString::Printf ("Error exporting IFC file. Error code: %d", err);
		DGAlert (DG_ERROR, GS::UniString ("Error"), errorMsg, GS::UniString (), GS::UniString ("OK"));
	} else {
		DGAlert (DG_INFORMATION, GS::UniString ("Success"), GS::UniString ("Project exported to IFC successfully!"), desktopLocation.ToDisplayText(), GS::UniString ("OK"));
	}

	delete savePars.file;
}