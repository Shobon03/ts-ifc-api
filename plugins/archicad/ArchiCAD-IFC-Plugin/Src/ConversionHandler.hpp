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

#ifndef CONVERSION_HANDLER_HPP
#define CONVERSION_HANDLER_HPP

#include <string>
#include <functional>

/**
 * @brief Handles conversion operations for Archicad
 *
 * This class manages the conversion of .pln files to IFC format
 * and provides progress callbacks.
 */
class ConversionHandler {
public:
    /**
     * @brief Progress callback function type
     * @param progress Progress percentage (0-100)
     * @param message Status message
     */
    typedef std::function<void(int progress, const std::string& message)> ProgressCallback;

    /**
     * @brief Convert .pln file to IFC format
     * @param jobId Unique job identifier
     * @param plnPath Path to input .pln file
     * @param outputPath Path for output IFC file
     * @param onProgress Progress callback function
     * @return true if conversion succeeded, false otherwise
     * 
     * NOTE: Due to Archicad API limitations, this function cannot automatically
     * open PLN files. The user must open the PLN file manually first.
     * Use ExportCurrentProjectToIfc() instead to export the currently open project.
     */
    static bool ConvertPlnToIfc(
        const std::string& jobId,
        const std::string& plnPath,
        const std::string& outputPath,
        ProgressCallback onProgress = nullptr
    );

    /**
     * @brief Export currently open project to IFC format
     * @param jobId Unique job identifier
     * @param outputPath Path for output IFC file
     * @param onProgress Progress callback function
     * @return true if export succeeded, false otherwise
     */
    static bool ExportCurrentProjectToIfc(
        const std::string& jobId,
        const std::string& outputPath,
        ProgressCallback onProgress = nullptr
    );

    /**
     * @brief Convert IFC file to .pln format
     * @param jobId Unique job identifier
     * @param ifcPath Path to input IFC file
     * @param outputPath Path for output .pln file
     * @param onProgress Progress callback function
     * @return true if conversion succeeded, false otherwise
     */
    static bool ConvertIfcToPln(
        const std::string& jobId,
        const std::string& ifcPath,
        const std::string& outputPath,
        ProgressCallback onProgress = nullptr
    );

    /**
     * @brief Cancel ongoing conversion
     * @param jobId Job identifier to cancel
     * @return true if cancelled, false if not found or already completed
     */
    static bool CancelConversion(const std::string& jobId);

    /**
     * @brief Check if a conversion is in progress
     * @param jobId Job identifier to check
     * @return true if conversion is running, false otherwise
     */
    static bool IsConversionInProgress(const std::string& jobId);

    /**
     * @brief Cleanup and reset conversion state
     *
     * This method should be called:
     * - When the plugin is shutting down
     * - To force cleanup after errors
     * - To prepare for new conversions
     *
     * It will:
     * - Close any open project
     * - Reset conversion state
     * - Allow new conversions to start
     */
    static void Cleanup();

private:
    static std::string s_currentJobId;
    static bool s_conversionInProgress;
    static bool s_shouldCancel;
};

#endif // CONVERSION_HANDLER_HPP
