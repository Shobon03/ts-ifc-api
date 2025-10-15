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

#ifndef PROGRESS_WINDOW_HPP
#define PROGRESS_WINDOW_HPP

#include "DG.h"
#include "DGModule.hpp"
#include <string>
#include <memory>

/**
 * @brief Progress window for conversion operations
 *
 * Displays a modal dialog with:
 * - Progress bar (0-100%)
 * - Status message
 * - Job ID
 * - Cancel button (optional)
 */
class ProgressWindow {
public:
    /**
     * @brief Create and show progress window
     * @param title Window title
     * @param initialMessage Initial status message
     */
    static void Show(const std::string& title = "Conversion Progress",
                     const std::string& initialMessage = "Starting...");

    /**
     * @brief Update progress and message
     * @param progress Progress percentage (0-100)
     * @param message Status message
     */
    static void UpdateProgress(int progress, const std::string& message);

    /**
     * @brief Set job ID display
     * @param jobId Current job identifier
     */
    static void SetJobId(const std::string& jobId);

    /**
     * @brief Close and destroy the window
     */
    static void Close();

    /**
     * @brief Check if window is currently shown
     * @return true if window is visible
     */
    static bool IsShown();

private:
    static short s_dialogId;
    static bool s_isShown;
};

#endif // PROGRESS_WINDOW_HPP
