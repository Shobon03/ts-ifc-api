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

#include "ACAPinc.h"
#include "APIEnvir.h"

/**
 * Exports an Archicad PLN project to an IFC file.
 * @param pln_path The path to the PLN file.
 * @param ifc_path The path where the IFC file will be saved.
 * @return GSErrCode indicating success or failure of the operation.
 */
GSErrCode ExportProjectToIFC(const IO::location& pln_path, const IO::Location& ifc_path) {
  // 1. Opens PLN file
  API_ProjectInfo projectInfo;
  projectInfo.location = &pln_path;

  GSErrCode err = ACAPI_ProjectOperation_Project(&projectInfo);
  if (err != NoError) return err;

  // 2. Configures IFC export settings
  API_FileSavePars fsp;
  BNZeroMemory(&fsp, sizeof(API_FileSavePars));
  fsp.fileTypeID = APIFType_IfcFile;
  fsp.file = new IO::Location(ifc_path);

  // 3. Configure IFC translator
  API_SavePars_Ifc pars_ifc;
  BNZeroMemory(&pars_ifc, sizeof(API_SavePars_Ifc));
  pars_ifc.subtype = API_IFC;

  // 4. Get IFC translator list
  GS::Array<API_IFCTranslatorIdentificer> ifcExportTranslators;
  err = ACAPI_IFC_GetIFCExportTranslatorsList(ifcExportTranslators);
  if(err == NoError && ifcExportTranslators.GetSize() > 0) {
    pars_ifc.translatorIdentifier = ifcExportTranslators[0]; // Select the first translator
  }

  // 5. Export to IFC
  err = ACAPI_Automate(APIDo_SaveID, &fsp, &pars_ifc);

  delete fsp.file;
  return err;
}

/**
 * Handler for the "Export to IFC" command.
 * This function is called when the user selects the export option from the menu.
 * @param menuParams Parameters passed from the menu command.
 * @return GSErrCode indicating success or failure of the operation.
 */
GSErrCode ExportCommand_Handler(const API_Menu_Params* menuParams) {
  IO::Location pln_path("C:\\temp\\input.pln");
  IO::Location ifc_path("C:\\temp\\output.ifc");

  return ExportProjectToIFC(pln_path, ifc_path);
}

/**
 * Registers the "Export to IFC" command in the Archicad menu.
 * @return GSErrCode indicating success or failure of the operation.
 */
GSErrCode RegisterInterface() {
  GSErrCode err = ACAPI_MenuItem_RegisterMenu(
    ID_MENU_STRINGS,
    ID_PROMPT_STRINGS,
    MenuCode_UserDef,
    MenuFlag_Default
  );

  if (err == NoError) {
    err = ACAPI_MenuItem_InstallMenuHandler(
      ID_EXPORT_TO_IFC,
      ExportCommand_Handler
    );
  }

  return err;
}