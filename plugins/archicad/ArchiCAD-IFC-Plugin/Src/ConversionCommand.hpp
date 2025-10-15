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

#ifndef CONVERSION_COMMAND_HPP
#define CONVERSION_COMMAND_HPP

#include "ACAPinc.h"
#include "APIdefs_Registration.h"
#include <string>

class ConversionCommand : public API_AddOnCommand {
public:
    ConversionCommand() = default;
    virtual ~ConversionCommand() = default;

    // Required overrides from API_AddOnCommand
    virtual GS::String GetName() const override {
        return "ConvertPlnToIfc";
    }

    virtual GS::String GetNamespace() const override {
        return "IFCPlugin";
    }

    virtual GS::Optional<GS::UniString> GetSchemaDefinitions() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetInputParametersSchema() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetResponseSchema() const override {
        return GS::NoValue;
    }

    virtual API_AddOnCommandExecutionPolicy GetExecutionPolicy() const override {
        // CRITICAL: Must run on main thread to avoid ODB assertion crashes
        return API_AddOnCommandExecutionPolicy::ScheduleForExecutionOnMainThread;
    }

    virtual bool IsProcessWindowVisible() const override {
        return false;
    }

    virtual GS::ObjectState Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const override;

    virtual void OnResponseValidationFailed(const GS::ObjectState& response) const override {
        // No action needed
    }
};

// Command for IFC to PLN conversion
class ConvertIfcToPlnCommand : public API_AddOnCommand {
public:
    ConvertIfcToPlnCommand() = default;
    virtual ~ConvertIfcToPlnCommand() = default;

    virtual GS::String GetName() const override {
        return "ConvertIfcToPln";
    }

    virtual GS::String GetNamespace() const override {
        return "IFCPlugin";
    }

    virtual GS::Optional<GS::UniString> GetSchemaDefinitions() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetInputParametersSchema() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetResponseSchema() const override {
        return GS::NoValue;
    }

    virtual API_AddOnCommandExecutionPolicy GetExecutionPolicy() const override {
        return API_AddOnCommandExecutionPolicy::ScheduleForExecutionOnMainThread;
    }

    virtual bool IsProcessWindowVisible() const override {
        return false;
    }

    virtual GS::ObjectState Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const override;

    virtual void OnResponseValidationFailed(const GS::ObjectState& response) const override {
        // No action needed
    }
};

// Simple command to load IFC - exactly like the menu does
class LoadIfcCommand : public API_AddOnCommand {
public:
    LoadIfcCommand() = default;
    virtual ~LoadIfcCommand() = default;

    virtual GS::String GetName() const override {
        return "LoadIfc";
    }

    virtual GS::String GetNamespace() const override {
        return "IFCPlugin";
    }

    virtual GS::Optional<GS::UniString> GetSchemaDefinitions() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetInputParametersSchema() const override {
        return GS::NoValue;
    }

    virtual GS::Optional<GS::UniString> GetResponseSchema() const override {
        return GS::NoValue;
    }

    virtual API_AddOnCommandExecutionPolicy GetExecutionPolicy() const override {
        return API_AddOnCommandExecutionPolicy::ScheduleForExecutionOnMainThread;
    }

    virtual bool IsProcessWindowVisible() const override {
        return false;
    }

    virtual GS::ObjectState Execute(const GS::ObjectState& parameters, GS::ProcessControl& processControl) const override;

    virtual void OnResponseValidationFailed(const GS::ObjectState& response) const override {
        // No action needed
    }
};

#endif