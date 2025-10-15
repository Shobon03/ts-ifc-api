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

#include "ConversionHandler.hpp"
#include "APIEnvir.h"
#include "ACAPinc.h"
#include "DGModule.hpp"
#include "File.hpp"
#include <ctime>
#include <iostream>
#include <thread>
#include <chrono>

// Static member initialization
std::string ConversionHandler::s_currentJobId = "";
bool ConversionHandler::s_conversionInProgress = false;
bool ConversionHandler::s_shouldCancel = false;

// Helper function to open a blank template
static void OpenBlankTemplate()
{
    std::cout << "Opening blank template..." << std::endl;

    try {
        API_NewProjectPars newProjectPars;
        BNZeroMemory(&newProjectPars, sizeof(API_NewProjectPars));

        GSErrCode err = ACAPI_ProjectOperation_NewProject(&newProjectPars);
        if (err != NoError) {
            std::cerr << "Warning: Could not open blank template. Code: " << err << std::endl;
        } else {
            std::cout << "✓ Blank template opened" << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "Exception opening blank template: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "Unknown exception opening blank template" << std::endl;
    }
}

bool ConversionHandler::ConvertPlnToIfc(
    const std::string& jobId,
    const std::string& plnPath,
    const std::string& outputPath,
    ProgressCallback onProgress
)
{
    // Check if another conversion is running
    if (s_conversionInProgress) {
        std::cerr << "Another conversion is already in progress" << std::endl;
        if (onProgress) {
            onProgress(0, "Error: Another conversion is already in progress");
        }
        return false;
    }

    s_conversionInProgress = true;
    s_currentJobId = jobId;
    s_shouldCancel = false;

    bool success = false;

    try {
        // Convert std::string to IO::Location
        GS::UniString plnPathUni(plnPath.c_str());
        IO::Location plnFileLocation(plnPathUni);

        // Verify file exists using IO::File
        IO::File plnFile(plnFileLocation);
        if (plnFile.GetStatus() != NoError) {
            std::string errorMsg = "Error: Cannot access .pln file";
            std::cerr << errorMsg << " Path: " << plnPath << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        // Progress: 20% - Closing current project if open
        if (onProgress) {
            onProgress(20, "Closing current project");
        }

        // Try to close any open project first to avoid conflicts
        try {
            GSErrCode closeErr = ACAPI_ProjectOperation_Close();
            if (closeErr != NoError && closeErr != APIERR_REFUSEDCMD) {
                // APIERR_REFUSEDCMD means no project is open, which is OK
                std::cerr << "Warning: Could not close current project. Code: " << closeErr << std::endl;
            }
            // Give ArchiCAD time to fully close the project
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        } catch (...) {
            std::cerr << "Warning: Exception while closing project" << std::endl;
        }

        // Progress: 30% - Opening .pln project
        if (onProgress) {
            onProgress(30, "Opening .pln project");
        }

        // Open the .pln file - same way as LoadIFCFile() does
        API_FileOpenPars openPars;
        BNZeroMemory(&openPars, sizeof(API_FileOpenPars));
        openPars.fileTypeID = APIFType_PlanFile;
        openPars.file = new IO::Location(plnFileLocation);

        GSErrCode err = NoError;
        try {
            err = ACAPI_ProjectOperation_Open(&openPars);
        } catch (const std::exception& e) {
            delete openPars.file;
            std::string errorMsg = std::string("Exception opening project: ") + e.what();
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        } catch (...) {
            delete openPars.file;
            std::string errorMsg = "Unknown exception opening project";
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        delete openPars.file;

        if (err != NoError) {
            std::string errorMsg = "Error opening .pln file. Code: " + std::to_string(err);
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        // Progress: 50% - Project opened, preparing IFC export
        if (onProgress) {
            onProgress(50, "Preparing IFC export");
        }

        // Get available IFC translators
        GS::Array<API_IFCTranslatorIdentifier> ifcTranslators;
        GSErrCode translatorErr = ACAPI_IFC_GetIFCExportTranslatorsList(ifcTranslators);

        if (translatorErr != NoError || ifcTranslators.IsEmpty()) {
            std::string errorMsg = "Error: No IFC translators available";
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        // Progress: 70% - Exporting to IFC
        if (onProgress) {
            onProgress(70, "Exporting to IFC");
        }

        // Setup IFC export parameters (same as ExportProjectAsIFC)
        API_SavePars_Ifc ifcPars;
        ifcPars.subType = API_IFC;
        ifcPars.translatorIdentifier = ifcTranslators[0];
        ifcPars.elementsToIfcExport = API_EntireProject;
        ifcPars.elementsSet = nullptr;
        ifcPars.includeBoundingBoxGeometry = false;
        ifcPars.filler_1 = nullptr;
        ifcPars.filler_2 = nullptr;

        // Setup save parameters
        GS::UniString outputPathUni(outputPath.c_str());
        IO::Location outputLocation(outputPathUni);

        API_FileSavePars savePars;
        BNZeroMemory(&savePars, sizeof(API_FileSavePars));
        savePars.fileTypeID = APIFType_IfcFile;
        savePars.file = new IO::Location(outputLocation);

        GSErrCode saveErr = NoError;
        try {
            saveErr = ACAPI_ProjectOperation_Save(&savePars, &ifcPars);
        } catch (const std::exception& e) {
            delete savePars.file;
            std::string errorMsg = std::string("Exception saving IFC: ") + e.what();
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        } catch (...) {
            delete savePars.file;
            std::string errorMsg = "Unknown exception saving IFC";
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        delete savePars.file;

        if (saveErr != NoError) {
            std::string errorMsg = "Error saving IFC file. Code: " + std::to_string(saveErr);
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto error;
        }

        // Progress: 100% - Completed
        if (onProgress) {
            onProgress(100, "Conversion completed successfully");
        }

        std::cout << "✓ Conversion completed: " << outputPath << std::endl;
        success = true;

    } catch (const std::exception& e) {
        std::cerr << "✗ Conversion failed: " << e.what() << std::endl;
        if (onProgress) {
            onProgress(0, std::string("Error: ") + e.what());
        }
    } catch (...) {
        std::cerr << "✗ Conversion failed: Unknown exception" << std::endl;
        if (onProgress) {
            onProgress(0, "Error: Unknown exception");
        }
    }

error:
    // ALWAYS close the project after conversion (success or failure)
    // This ensures consecutive conversions can work properly
    try {
        GSErrCode closeErr = ACAPI_ProjectOperation_Close();
        if (closeErr != NoError && closeErr != APIERR_REFUSEDCMD) {
            std::cerr << "Warning: Could not close project in cleanup. Code: " << closeErr << std::endl;
        } else {
            std::cout << "✓ Project closed in cleanup" << std::endl;
        }
    } catch (...) {
        std::cerr << "Warning: Exception while closing project in cleanup" << std::endl;
    }

    // Open a blank template so WebSocket stays responsive
    // and user doesn't see the converted project
    OpenBlankTemplate();

    // Reset state
    s_conversionInProgress = false;
    s_currentJobId = "";

    return success;
}

bool ConversionHandler::ConvertIfcToPln(
    const std::string& jobId,
    const std::string& ifcPath,
    const std::string& outputPath,
    ProgressCallback onProgress
)
{
    // Check if another conversion is running
    if (s_conversionInProgress) {
        std::cerr << "Another conversion is already in progress" << std::endl;
        if (onProgress) {
            onProgress(0, "Error: Another conversion is already in progress");
        }
        return false;
    }

    s_conversionInProgress = true;
    s_currentJobId = jobId;
    s_shouldCancel = false;

    bool success = false;

    try {
        // Convert std::string to IO::Location
        GS::UniString ifcPathUni(ifcPath.c_str());
        IO::Location ifcFileLocation(ifcPathUni);

        // Verify file exists
        IO::File ifcFile(ifcFileLocation);
        if (ifcFile.GetStatus() != NoError) {
            std::string errorMsg = "Error: Cannot access IFC file";
            std::cerr << errorMsg << " Path: " << ifcPath << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        }

        // Progress: 20% - Closing current project
        if (onProgress) {
            onProgress(20, "Closing current project");
        }

        // Close any open project first
        try {
            GSErrCode closeErr = ACAPI_ProjectOperation_Close();
            if (closeErr != NoError && closeErr != APIERR_REFUSEDCMD) {
                std::cerr << "Warning: Could not close current project. Code: " << closeErr << std::endl;
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        } catch (...) {
            std::cerr << "Warning: Exception while closing project" << std::endl;
        }

        // Progress: 40% - Loading IFC file
        if (onProgress) {
            onProgress(40, "Loading IFC file");
        }

        // Open IFC file - exactly like LoadIFCFile() does
        API_FileOpenPars openPars;
        BNZeroMemory(&openPars, sizeof(API_FileOpenPars));
        openPars.fileTypeID = APIFType_IfcFile;
        openPars.useStoredLib = true;  // Use stored library (like menu does)
        openPars.libGiven = false;      // Library not explicitly given (like menu does)
        openPars.file = new IO::Location(ifcFileLocation);

        GSErrCode err = NoError;
        try {
            err = ACAPI_ProjectOperation_Open(&openPars);
        } catch (const std::exception& e) {
            delete openPars.file;
            std::string errorMsg = std::string("Exception opening IFC: ") + e.what();
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        } catch (...) {
            delete openPars.file;
            std::string errorMsg = "Unknown exception opening IFC";
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        }

        delete openPars.file;

        if (err != NoError) {
            std::string errorMsg = "Error opening IFC file. Code: " + std::to_string(err);
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        }

        // Progress: 70% - Saving as PLN
        if (onProgress) {
            onProgress(70, "Saving as PLN file");
        }

        // Save as PLN
        GS::UniString outputPathUni(outputPath.c_str());
        IO::Location outputLocation(outputPathUni);

        API_FileSavePars savePars;
        BNZeroMemory(&savePars, sizeof(API_FileSavePars));
        savePars.fileTypeID = APIFType_PlanFile;
        savePars.file = new IO::Location(outputLocation);

        GSErrCode saveErr = NoError;
        try {
            saveErr = ACAPI_ProjectOperation_Save(&savePars);
        } catch (const std::exception& e) {
            delete savePars.file;
            std::string errorMsg = std::string("Exception saving PLN: ") + e.what();
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        } catch (...) {
            delete savePars.file;
            std::string errorMsg = "Unknown exception saving PLN";
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        }

        delete savePars.file;

        if (saveErr != NoError) {
            std::string errorMsg = "Error saving PLN file. Code: " + std::to_string(saveErr);
            std::cerr << errorMsg << std::endl;
            if (onProgress) {
                onProgress(0, errorMsg);
            }
            goto ifc_error;
        }

        // Progress: 100% - Completed
        if (onProgress) {
            onProgress(100, "Conversion completed successfully");
        }

        std::cout << "✓ IFC to PLN conversion completed: " << outputPath << std::endl;
        success = true;

    } catch (const std::exception& e) {
        std::cerr << "✗ IFC to PLN conversion failed: " << e.what() << std::endl;
        if (onProgress) {
            onProgress(0, std::string("Error: ") + e.what());
        }
    } catch (...) {
        std::cerr << "✗ IFC to PLN conversion failed: Unknown exception" << std::endl;
        if (onProgress) {
            onProgress(0, "Error: Unknown exception");
        }
    }

ifc_error:
    // ALWAYS close the project after conversion (success or failure)
    // This ensures consecutive conversions can work properly
    try {
        GSErrCode closeErr = ACAPI_ProjectOperation_Close();
        if (closeErr != NoError && closeErr != APIERR_REFUSEDCMD) {
            std::cerr << "Warning: Could not close project in cleanup. Code: " << closeErr << std::endl;
        } else {
            std::cout << "✓ Project closed in cleanup" << std::endl;
        }
    } catch (...) {
        std::cerr << "Warning: Exception while closing project in cleanup" << std::endl;
    }

    // Open a blank template so WebSocket stays responsive
    // and user doesn't see the converted project
    OpenBlankTemplate();

    // Reset state
    s_conversionInProgress = false;
    s_currentJobId = "";

    return success;
}

bool ConversionHandler::CancelConversion(const std::string& jobId)
{
    if (!s_conversionInProgress || s_currentJobId != jobId) {
        return false;
    }

    s_shouldCancel = true;
    std::cout << "Cancellation requested for job: " << jobId << std::endl;
    return true;
}

bool ConversionHandler::IsConversionInProgress(const std::string& jobId)
{
    return s_conversionInProgress && (s_currentJobId == jobId);
}

void ConversionHandler::Cleanup()
{
    std::cout << "ConversionHandler::Cleanup() - Starting cleanup..." << std::endl;

    // Try to close any open project
    try {
        GSErrCode closeErr = ACAPI_ProjectOperation_Close();
        if (closeErr != NoError && closeErr != APIERR_REFUSEDCMD) {
            std::cerr << "Warning: Could not close project during cleanup. Code: " << closeErr << std::endl;
        } else if (closeErr == NoError) {
            std::cout << "✓ Project closed during cleanup" << std::endl;
        } else {
            std::cout << "✓ No project was open (cleanup)" << std::endl;
        }
    } catch (const std::exception& e) {
        std::cerr << "Exception during project close: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "Unknown exception during project close" << std::endl;
    }

    // Reset state
    s_conversionInProgress = false;
    s_currentJobId = "";
    s_shouldCancel = false;

    std::cout << "✓ ConversionHandler cleanup completed" << std::endl;
}
